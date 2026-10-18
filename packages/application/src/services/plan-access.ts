import { DomainError, Permissions, canActOnPlanItem, ok, err, type PlanItemAction, type PlannedActivity, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IPlannedActivityRepository } from "../ports/workplan.js";

/** Loads a planned activity of the caller's tenant and checks the caller may do `action` to it. One place, used by every plan handler. */
export class PlanAccess {
  constructor(private readonly repo: IPlannedActivityRepository) {}

  async load(ctx: AuthenticatedContext, id: string, action: PlanItemAction): Promise<Result<PlannedActivity, DomainError>> {
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("PlannedActivity", id));
    const allowed = canActOnPlanItem({ userId: ctx.tenant.userId, role: ctx.tenant.role as Role }, { ownerUserId: found.value.ownerUserId, supportUserIds: found.value.supportUserIds }, action);
    return allowed ? ok(found.value) : err(DomainError.forbidden("You cannot change this activity", { action }));
  }

  static requireManage(ctx: AuthenticatedContext): Result<void, DomainError> {
    return Permissions.can(ctx.tenant.role as Role, "workplan.manage") ? ok(undefined) : err(DomainError.forbidden("You cannot manage the work plan"));
  }
}
