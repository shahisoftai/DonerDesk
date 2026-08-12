import type { Result } from "@donordesk/domain";
import { DomainError, Email, TenantId } from "@donordesk/domain";
import type { IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface LoginCommand {
  email: string;
  password: string;
}

export class LoginHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(cmd: LoginCommand): Promise<Result<{ userId: string; tenantId: string; token: string; role: string; name: string }, DomainError>> {
    let email: Email;
    try {
      email = Email.create(cmd.email);
    } catch (e) {
      return e instanceof DomainError ? { ok: false, error: e } : { ok: false, error: DomainError.validation("Invalid email") };
    }

    const userResult = await this.users.findByEmailGlobal(email.toString());
    if (!userResult.ok) return userResult;
    if (!userResult.value) return { ok: false, error: DomainError.notFound("User", email.toString()) };
    const user = userResult.value;
    if (user.status === "REMOVED") return { ok: false, error: DomainError.forbidden("Account removed") };
    if (user.status === "SUSPENDED") return { ok: false, error: DomainError.forbidden("Account suspended") };

    const ok = await this.auth.verifyPassword(cmd.password, user.passwordHash);
    if (!ok) return { ok: false, error: DomainError.forbidden("Invalid credentials") };

    user.recordLogin();
    await this.users.update(user);

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id.toString(),
      eventType: "identity.user.login",
      entityType: "user",
      entityId: user.id.toString(),
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
      },
    };
  }
}
