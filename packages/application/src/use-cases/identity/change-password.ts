import type { Result } from "@donordesk/domain";
import { DomainError, PasswordPolicy, TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: {
      verifyPassword(plain: string, hash: string): Promise<boolean>;
      hashPassword(plain: string): Promise<string>;
    },
    private readonly audit: IAuditLogger,
    private readonly clock: { now(): Date } = new (class { now() { return new Date(); } })(),
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: ChangePasswordCommand): Promise<Result<void, DomainError>> {
    if (!cmd.currentPassword || !cmd.newPassword) {
      return { ok: false, error: DomainError.validation("Current and new passwords are required") };
    }
    const policy = PasswordPolicy.validate(cmd.newPassword);
    if (!policy.ok) {
      return { ok: false, error: DomainError.validation(policy.errors[0] ?? "Password does not meet policy", { errors: policy.errors }) };
    }

    const userResult = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!userResult.ok) return userResult;
    if (!userResult.value) return { ok: false, error: DomainError.notFound("User", ctx.tenant.userId) };
    const user = userResult.value;

    const ok = await this.auth.verifyPassword(cmd.currentPassword, user.passwordHash);
    if (!ok) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "auth.password.change_failed",
        entityType: "user",
        entityId: ctx.tenant.userId,
        systemNote: "Invalid current password",
        ipAddress: ctx.ipAddress,
      });
      return { ok: false, error: DomainError.forbidden("Current password is incorrect") };
    }

    const newHash = await this.auth.hashPassword(cmd.newPassword);
    const now = this.clock.now();
    const updated = await this.users.updatePasswordHash(user.id.toString(), ctx.tenant.tenantId, newHash);
    if (!updated.ok) return updated;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "auth.password.changed",
      entityType: "user",
      entityId: ctx.tenant.userId,
      ipAddress: ctx.ipAddress,
      newValue: JSON.stringify({ passwordChangedAt: now.toISOString() }),
    });
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "auth.session.invalidated",
      entityType: "user",
      entityId: ctx.tenant.userId,
      systemNote: "Password changed; pre-change JWTs should be rejected",
      ipAddress: ctx.ipAddress,
    });

    return { ok: true, value: undefined };
  }
}
