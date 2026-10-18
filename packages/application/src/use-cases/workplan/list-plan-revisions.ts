import { DomainError, err, ok, type PlanChangeSet, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPlanRevisionRepository, IPlannedActivityRepository } from "../../ports/workplan.js";

export interface PlanRevisionDto {
  id: string;
  changes: PlanChangeSet;
  reason?: string;
  changedById: string;
  changedAt: string;
}

/** The history of one planned activity, oldest first: the project's decision history ("moved from 12 Mar: floods"). */
export class ListPlanRevisionsHandler {
  constructor(private readonly plans: IPlannedActivityRepository, private readonly revisions: IPlanRevisionRepository) {}

  async handle(ctx: AuthenticatedContext, plannedActivityId: string): Promise<Result<PlanRevisionDto[], DomainError>> {
    const item = await this.plans.findById(plannedActivityId, ctx.tenant.tenantId);
    if (!item.ok) return item;
    if (!item.value) return err(DomainError.notFound("PlannedActivity", plannedActivityId));
    const found = await this.revisions.findByPlannedActivity(plannedActivityId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    return ok(found.value.map((r) => ({ id: r.id, changes: r.change, ...(r.reason ? { reason: r.reason } : {}), changedById: r.changedById, changedAt: r.changedAt.toISOString() })));
  }
}
