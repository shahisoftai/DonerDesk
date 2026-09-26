import type { Result } from "@donordesk/domain";
import { DomainError, PasswordPolicy, PasswordResetToken, TenantId } from "@donordesk/domain";
import type { IUserRepository, IPasswordResetTokenRepository } from "../../ports/identity.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";

const PLATFORM_TENANT = TenantId.create("platform");

export interface ConfirmPasswordResetCommand {
  token: string;
  newPassword: string;
  ipAddress?: string;
}

export class ConfirmPasswordResetHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: IPasswordResetTokenRepository,
    private readonly auth: { hashPassword(plain: string): Promise<string> },
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(cmd: ConfirmPasswordResetCommand): Promise<Result<void, DomainError>> {
    if (!cmd.token || !cmd.newPassword) {
      return { ok: false, error: DomainError.validation("Token and new password are required") };
    }
    const policy = PasswordPolicy.validate(cmd.newPassword);
    if (!policy.ok) {
      return { ok: false, error: DomainError.validation(policy.errors[0] ?? "Password does not meet policy", { errors: policy.errors }) };
    }

    const tokenHash = PasswordResetToken.hash(cmd.token);
    const lookup = await this.tokens.findActiveByHash(tokenHash);
    if (!lookup.ok) return lookup;
    const token = lookup.value;
    if (!token) {
      await this.audit.record({
        tenantId: PLATFORM_TENANT,
        actorId: "anonymous",
        eventType: "auth.password.reset_failed",
        entityType: "password_reset_token",
        entityId: "unknown",
        systemNote: "INVALID_OR_EXPIRED_TOKEN",
        ipAddress: cmd.ipAddress,
      });
      return { ok: false, error: DomainError.validation("Invalid or expired token", { code: "INVALID_OR_EXPIRED_TOKEN" }) };
    }

    if (token.isUsed()) {
      await this.audit.record({
        tenantId: token.tenantId,
        actorId: token.userId,
        eventType: "auth.password.reset_failed",
        entityType: "password_reset_token",
        entityId: token.id.toString(),
        systemNote: "Token already used",
        ipAddress: cmd.ipAddress,
      });
      return { ok: false, error: DomainError.validation("Invalid or expired token", { code: "INVALID_OR_EXPIRED_TOKEN" }) };
    }
    if (token.isExpired(this.clock.now())) {
      await this.audit.record({
        tenantId: token.tenantId,
        actorId: token.userId,
        eventType: "auth.password.reset_failed",
        entityType: "password_reset_token",
        entityId: token.id.toString(),
        systemNote: "Token expired",
        ipAddress: cmd.ipAddress,
      });
      return { ok: false, error: DomainError.validation("Invalid or expired token", { code: "INVALID_OR_EXPIRED_TOKEN" }) };
    }

    const userResult = await this.users.findByIdGlobal(token.userId);
    if (!userResult.ok) return userResult;
    if (!userResult.value) {
      return { ok: false, error: DomainError.notFound("User", token.userId) };
    }
    const user = userResult.value;

    const newHash = await this.auth.hashPassword(cmd.newPassword);
    const updated = await this.users.updatePasswordHash(user.id.toString(), token.tenantId, newHash);
    if (!updated.ok) return updated;

    const now = this.clock.now();
    const marked = await this.tokens.markUsed(token.id.toString(), token.tenantId);
    if (!marked.ok) return marked;

    await this.audit.record({
      tenantId: token.tenantId,
      actorId: user.id.toString(),
      eventType: "auth.password.reset_completed",
      entityType: "user",
      entityId: user.id.toString(),
      ipAddress: cmd.ipAddress,
      newValue: JSON.stringify({ tokenId: token.id.toString(), passwordChangedAt: now.toISOString() }),
    });
    await this.audit.record({
      tenantId: token.tenantId,
      actorId: user.id.toString(),
      eventType: "auth.session.invalidated",
      entityType: "user",
      entityId: user.id.toString(),
      systemNote: "Password reset completed; pre-reset JWTs should be rejected",
      ipAddress: cmd.ipAddress,
    });

    return { ok: true, value: undefined };
  }
}
