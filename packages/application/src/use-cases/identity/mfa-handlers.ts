import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, TenantId, minutesUntil, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IAuthProvider, IMfaService, IUserRepository } from "../../ports/identity.js";

const ISSUER = "DonorDesk";
const WRONG_CODE = "That code is not right. Use the current code from your authenticator app, or one of your recovery codes.";

/** A recovery code looks like `abcde-fghij`; an authenticator code is six digits. */
const looksLikeRecoveryCode = (code: string): boolean => /[a-z]/i.test(code) || code.includes("-");

/**
 * Checks a code against a user who has two-step sign-in on: a six-digit code from the app (each time step works once) or
 * a recovery code (each works once). Returns true when it is good; the caller decides what a failure costs.
 */
function acceptCode(user: import("@donordesk/domain").User, mfa: IMfaService, code: string, now: Date): boolean {
  if (looksLikeRecoveryCode(code)) return user.useRecoveryCode(mfa.hashRecoveryCode(code));
  const secret = user.mfaSecretEnc;
  if (!secret) return false;
  const step = mfa.matchingStep(mfa.decrypt(secret), code, now);
  return step !== null && user.acceptMfaStep(step);
}

export interface SessionResult { userId: string; tenantId: string; token: string; role: string; name: string }

/** Second step of sign-in: the challenge from the password step plus a code. A wrong code counts toward the same lockout. */
export class CompleteMfaLoginHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly mfa: IMfaService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(cmd: { challenge: string; code: string }): Promise<Result<SessionResult, DomainError>> {
    const now = new Date();
    const claim = this.mfa.readChallenge(cmd.challenge, now);
    if (!claim) return { ok: false, error: DomainError.forbidden("Your sign-in took too long. Please start again.") };
    const found = await this.users.findById(claim.userId, TenantId.create(claim.tenantId));
    if (!found.ok) return found;
    const user = found.value;
    if (!user || user.status !== "ACTIVE" || !user.mfaEnabled) return { ok: false, error: DomainError.forbidden("Your sign-in took too long. Please start again.") };

    const lock = user.lockedAt(now);
    if (lock) {
      return { ok: false, error: DomainError.forbidden(`Too many failed sign-in attempts. Try again in ${minutesUntil(lock, now)} minutes, or reset your password.`) };
    }
    if (!acceptCode(user, this.mfa, cmd.code, now)) {
      const lockedUntil = user.recordFailedLogin(now);
      await this.users.update(user);
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id.toString(),
        eventType: lockedUntil ? "identity.user.locked" : "identity.mfa.failed",
        entityType: "user",
        entityId: user.id.toString(),
        newValue: JSON.stringify({ failedLoginCount: user.failedLoginCount }),
      });
      return { ok: false, error: DomainError.forbidden(WRONG_CODE) };
    }

    user.recordLogin();
    const saved = await this.users.update(user);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id.toString(), eventType: "identity.user.login", entityType: "user", entityId: user.id.toString(), newValue: JSON.stringify({ mfa: true }) });
    const token = await this.auth.sign({ sub: user.id.toString(), tid: user.tenantId.toString(), role: user.role, name: user.name, email: user.email.toString(), ...(user.external ? { ext: true } : {}) }, 60 * 60 * 24 * 7);
    return { ok: true, value: { userId: user.id.toString(), tenantId: user.tenantId.toString(), token, role: user.role, name: user.name } };
  }
}

/** Whether two-step sign-in is on, and how many recovery codes are left. */
export class GetMfaStatusHandler {
  constructor(private readonly users: IUserRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ enabled: boolean; enabledAt: Date | null; recoveryCodesLeft: number }, DomainError>> {
    const found = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("User", ctx.tenant.userId) };
    return { ok: true, value: { enabled: found.value.mfaEnabled, enabledAt: found.value.mfaEnabledAt, recoveryCodesLeft: found.value.mfaRecoveryHashes.length } };
  }
}

/** Step one of turning it on: a new secret, shown once as a key and a link. Nothing is protected until a code proves it. */
export class BeginMfaEnrollmentHandler {
  constructor(private readonly users: IUserRepository, private readonly mfa: IMfaService) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ secret: string; otpauthUri: string }, DomainError>> {
    const found = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const user = found.value;
    if (!user) return { ok: false, error: DomainError.notFound("User", ctx.tenant.userId) };
    try {
      const secret = this.mfa.newSecret();
      user.beginMfaEnrollment(this.mfa.encrypt(secret));
      const saved = await this.users.update(user);
      if (!saved.ok) return saved;
      return { ok: true, value: { secret, otpauthUri: this.mfa.otpauthUri(secret, user.email.toString(), ISSUER) } };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, error };
      throw error;
    }
  }
}

/** Step two: the first code from the app turns it on and returns the recovery codes, once. */
export class EnableMfaHandler {
  constructor(private readonly users: IUserRepository, private readonly mfa: IMfaService, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, code: string): Promise<Result<{ recoveryCodes: string[] }, DomainError>> {
    const found = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const user = found.value;
    if (!user) return { ok: false, error: DomainError.notFound("User", ctx.tenant.userId) };
    if (user.mfaEnabled) return { ok: false, error: DomainError.conflict("Two-step sign-in is already on.") };
    const pending = user.mfaPendingSecretEnc;
    if (!pending) return { ok: false, error: DomainError.validation("Start the setup first, then enter the code from your app.") };
    const now = new Date();
    const step = this.mfa.matchingStep(this.mfa.decrypt(pending), code, now);
    if (step === null) return { ok: false, error: DomainError.validation("That code is not right. Check that the time on your phone is correct and try the next code.") };
    const { codes, hashes } = this.mfa.newRecoveryCodes();
    user.enableMfa(now, hashes, step);
    const saved = await this.users.update(user);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "identity.mfa.enabled", entityType: "user", entityId: user.id.toString() });
    return { ok: true, value: { recoveryCodes: codes } };
  }
}

/** Turning it off needs the password and a code (or recovery code): a stolen session alone cannot remove the protection. */
export class DisableMfaHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly mfa: IMfaService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: { password: string; code: string }): Promise<Result<void, DomainError>> {
    const found = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const user = found.value;
    if (!user) return { ok: false, error: DomainError.notFound("User", ctx.tenant.userId) };
    if (!user.mfaEnabled) return { ok: true, value: undefined };
    if (!(await this.auth.verifyPassword(input.password, user.passwordHash))) return { ok: false, error: DomainError.forbidden("The password is not right.") };
    if (!acceptCode(user, this.mfa, input.code, new Date())) return { ok: false, error: DomainError.forbidden(WRONG_CODE) };
    user.disableMfa();
    const saved = await this.users.update(user);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "identity.mfa.disabled", entityType: "user", entityId: user.id.toString() });
    return { ok: true, value: undefined };
  }
}

/** An administrator clears someone's two-step sign-in (a lost phone). The person signs in with their password and sets it up again. */
export class ResetUserMfaHandler {
  constructor(private readonly users: IUserRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, userId: string): Promise<Result<void, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "users.manage");
    const found = await this.users.findById(userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("User", userId) };
    found.value.disableMfa();
    const saved = await this.users.update(found.value);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "identity.mfa.reset_by_admin", entityType: "user", entityId: userId, newValue: JSON.stringify({ by: ctx.tenant.userId }) });
    return { ok: true, value: undefined };
  }
}
