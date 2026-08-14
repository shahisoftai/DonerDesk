import type { Result } from "@donordesk/domain";
import { DomainError, Email } from "@donordesk/domain";
import type { IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IGoogleSignInConnector } from "../../ports/infrastructure.js";

export interface GoogleSignInCommand {
  code: string;
}

/**
 * Google Sign-In handler. Exchanges the OAuth code for a verified Google
 * profile and signs in the user whose email matches. Mirrors LoginHandler but
 * uses Google's verified identity instead of a password.
 *
 * Only existing accounts can sign in with Google; account provisioning remains
 * the responsibility of the signup flow.
 */
export class GoogleSignInHandler {
  constructor(
    private readonly google: IGoogleSignInConnector,
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(cmd: GoogleSignInCommand): Promise<Result<{ userId: string; tenantId: string; token: string; role: string; name: string; email: string }, DomainError>> {
    let profile;
    try {
      profile = await this.google.exchangeCode(cmd.code);
    } catch (error) {
      return { ok: false, error: DomainError.forbidden(error instanceof Error ? error.message : "Google Sign-In failed") };
    }

    let email: Email;
    try {
      email = Email.create(profile.email);
    } catch {
      return { ok: false, error: DomainError.validation("Google account email is invalid") };
    }

    const userResult = await this.users.findByEmailGlobal(email.toString());
    if (!userResult.ok) return userResult;
    if (!userResult.value) return { ok: false, error: DomainError.notFound("User", email.toString()) };
    const user = userResult.value;
    if (user.status === "REMOVED") return { ok: false, error: DomainError.forbidden("Account removed") };
    if (user.status === "SUSPENDED") return { ok: false, error: DomainError.forbidden("Account suspended") };

    user.recordLogin();
    await this.users.update(user);

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id.toString(),
      eventType: "identity.user.login",
      entityType: "user",
      entityId: user.id.toString(),
      newValue: "google",
    });

    const token = await this.auth.sign(
      {
        sub: user.id.toString(),
        tid: user.tenantId.toString(),
        role: user.role,
        name: user.name,
        email: user.email.toString(),
      },
      60 * 60 * 24 * 7,
    );

    return {
      ok: true,
      value: {
        userId: user.id.toString(),
        tenantId: user.tenantId.toString(),
        token,
        role: user.role,
        name: user.name,
        email: user.email.toString(),
      },
    };
  }
}
