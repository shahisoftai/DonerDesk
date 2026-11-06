import {
  DomainError, canAddDependency, err, ok, type PlanDependencyItem, type PlanDependencyLink, type PlannedActivity, type Result, type TenantId,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPlanDependencyRepository, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

/** What the dependency rules need to know about an activity. */
export function toDependencyItem(item: PlannedActivity): PlanDependencyItem {
  const s = item.snapshot();
  return { id: item.id, projectId: item.projectId, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd, status: s.status };
}

export const toDependencyLink = (r: { predecessorId: string; successorId: string }): PlanDependencyLink => ({ predecessorId: r.predecessorId, successorId: r.successorId });

export interface AddPlanDependencyInput {
  predecessorId: string;
  successorId: string;
}

export class AddPlanDependencyHandler {
  constructor(
    private readonly items: IPlannedActivityRepository, private readonly links: IPlanDependencyRepository,
    private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: AddPlanDependencyInput): Promise<Result<{ id: string }, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId: TenantId = ctx.tenant.tenantId;
    const pred = await this.items.findById(input.predecessorId, tenantId);
    if (!pred.ok) return pred;
    if (!pred.value) return err(DomainError.notFound("PlannedActivity", input.predecessorId));
    const succ = await this.items.findById(input.successorId, tenantId);
    if (!succ.ok) return succ;
    if (!succ.value) return err(DomainError.notFound("PlannedActivity", input.successorId));
    if (succ.value.projectId !== pred.value.projectId) return err(DomainError.validation("Only activities in the same project can depend on each other"));
    const projectId = pred.value.projectId;
    const all = await this.items.findByProject(projectId, tenantId);
    if (!all.ok) return all;
    const current = await this.links.findByProject(projectId, tenantId);
    if (!current.ok) return current;
    const check = canAddDependency(current.value.map(toDependencyLink), all.value.map(toDependencyItem), input.predecessorId, input.successorId);
    if (!check.ok) return check;

    const id = this.ids.generate();
    const saved = await this.links.add({
      id, tenantId: tenantId.toString(), projectId, predecessorId: input.predecessorId, successorId: input.successorId,
      createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.dependency_added", entityType: "planned_activity", entityId: input.successorId, projectId,
      newValue: JSON.stringify({ predecessorId: input.predecessorId }),
    });
    return ok({ id });
  }
}

export class RemovePlanDependencyHandler {
  constructor(private readonly items: IPlannedActivityRepository, private readonly links: IPlanDependencyRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: AddPlanDependencyInput): Promise<Result<void, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId = ctx.tenant.tenantId;
    const succ = await this.items.findById(input.successorId, tenantId);
    if (!succ.ok) return succ;
    if (!succ.value) return err(DomainError.notFound("PlannedActivity", input.successorId));
    const removed = await this.links.remove(input.predecessorId, input.successorId, tenantId);
    if (!removed.ok) return removed;
    if (!removed.value) return err(DomainError.notFound("Dependency", `${input.predecessorId}→${input.successorId}`));
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.dependency_removed", entityType: "planned_activity", entityId: input.successorId,
      projectId: succ.value.projectId, newValue: JSON.stringify({ predecessorId: input.predecessorId }),
    });
    return ok(undefined);
  }
}
