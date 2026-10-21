import type { Result } from "@donordesk/domain";
import { DomainError, Email, minutesUntil } from "@donordesk/domain";
import type { IUserRepository, IAuthProvider, IMfaService } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface LoginCommand {
  email: string;
  password: string;
}

/** A signed-in person's session, or — when two-step sign-in is on — the challenge to answer with a code. */
export type LoginOutcome =
  | { userId: string; tenantId: string; token: string; role: string; name: string }
  | { mfaRequired: true; challenge: string };

export class LoginHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly audit: IAuditLogger,
    /** With this, a person who turned on two-step sign-in is asked for a code after the password. */
    private readonly mfa?: IMfaService,
  ) {}

  async handle(cmd: LoginCommand): Promise<Result<LoginOutcome, DomainError>> {
    let email: Email;
    try {
      email = Email.create(cmd.email);
    } catch (e) {
      return e instanceof DomainError ? { ok: false, error: e } : { ok: false, error: DomainError.validation("Invalid email") };
    }

    const userResult = await this.users.findByEmailGlobal(email.toString());
    if (!userResult.ok) return userResult;
    // Same answer as a wrong password, so the form cannot be used to find out which addresses have accounts.
    if (!userResult.value) return { ok: false, error: DomainError.forbidden("Invalid credentials") };
    const user = userResult.value;
    if (user.status === "REMOVED") return { ok: false, error: DomainError.forbidden("Account removed") };
    if (user.status === "SUSPENDED") return { ok: false, error: DomainError.forbidden("Account suspended") };

    const now = new Date();
    const lock = user.lockedAt(now);
    if (lock) {
      return { ok: false, error: DomainError.forbidden(`Too many failed sign-in attempts. Try again in ${minutesUntil(lock, now)} minutes, or reset your password.`) };
    }

    const ok = await this.auth.verifyPassword(cmd.password, user.passwordHash);
    if (!ok) {
      const lockedUntil = user.recordFailedLogin(now);
      await this.users.update(user);
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id.toString(),
        eventType: lockedUntil ? "identity.user.locked" : "identity.user.login_failed",
        entityType: "user",
        entityId: user.id.toString(),
        newValue: JSON.stringify({ failedLoginCount: user.failedLoginCount }),
      });
      return { ok: false, error: DomainError.forbidden("Invalid credentials") };
    }

    // The password was right. With two-step sign-in on, that is not yet a sign-in: hand back a short-lived challenge and
    // finish in `CompleteMfaLoginHandler`. Nothing is recorded as a login until the code is right.
    if (user.mfaEnabled && this.mfa) {
      return { ok: true, value: { mfaRequired: true, challenge: this.mfa.issueChallenge(user.id.toString(), user.tenantId.toString(), now) } };
    }

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
        ...(user.external ? { ext: true } : {}),
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
