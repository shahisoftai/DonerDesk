import type { Result } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { Role } from "@donordesk/domain";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { applyEntitlementLimit } from "../../services/entitlement-service.js";

export interface ChangeRoleCommand {
  userId: string;
  role: Role;
}

export class ChangeRoleHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: ChangeRoleCommand): Promise<Result<void, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "users.manage");
    const target = await this.users.findById(cmd.userId, ctx.tenant.tenantId);
    if (!target.ok) return target;
    if (!target.value) return { ok: false, error: DomainError.notFound("User", cmd.userId) };
    const user = target.value;
    const from = user.role;

    // Moving into/out of VIEWER crosses the two independent seat pools:
    // re-check the pool the user is moving into (freeing a seat in the other
    // pool is always fine; claiming one in the destination pool is not).
    if (cmd.role !== from && (cmd.role === "VIEWER" || from === "VIEWER")) {
      const entitlementResult = await this.entitlements.resolve({ tenantId: ctx.tenant.tenantId.toString() });
      if (!entitlementResult.ok) return entitlementResult;
      const isMovingToViewer = cmd.role === "VIEWER";
      const limit = isMovingToViewer ? entitlementResult.value.limits.viewerSeats : entitlementResult.value.limits.maxSeats;
      if (limit !== null) {
        const usageResult = await this.entitlements.usageSnapshot({ tenantId: ctx.tenant.tenantId.toString() });
        if (!usageResult.ok) return usageResult;
        const used = isMovingToViewer ? usageResult.value.viewerSeats : usageResult.value.seats;
        if (used >= limit) {
          const enforced = await applyEntitlementLimit(
            this.audit,
            ctx.tenant.tenantId,
            ctx.tenant.userId,
            isMovingToViewer ? "VIEWERS" : "SEATS",
            limit,
            used,
          );
          if (!enforced.ok) return enforced;
        }
      }
    }

    user.changeRole(cmd.role);
    const update = await this.users.update(user);
    if (!update.ok) return update;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.user.role_changed",
      entityType: "user",
      entityId: cmd.userId,
      oldValue: from,
      newValue: cmd.role,
    });
    return { ok: true, value: undefined };
  }
}
