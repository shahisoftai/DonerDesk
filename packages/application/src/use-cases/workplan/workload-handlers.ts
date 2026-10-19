import { DomainError, err, ok, parseCapacity, toPlainDate, upcomingWeeks, workloadGrid, type PlainDate, type Result, type WorkloadRow } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IMemberCapacityRepository, IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

/** Who is loaded, week by week, across the project's open planned activities. Only the project's own people are shown. */
export class GetWorkloadHandler {
  constructor(private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader, private readonly capacity: IMemberCapacityRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ weeks: PlainDate[]; rows: WorkloadRow[] }, DomainError>> {
    const members = await this.context.activeMemberIds(projectId, ctx.tenant.tenantId);
    if (!members.ok) return members;
    if (ctx.tenant.role !== "ADMIN" && !members.value.has(ctx.tenant.userId)) return err(DomainError.forbidden("You are not on this project"));
    const ids = [...members.value];
    const caps = await this.capacity.findMany(ids, ctx.tenant.tenantId);
    if (!caps.ok) return caps;
    const items = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const weeks = upcomingWeeks(toPlainDate(this.clock.now())!);
    const rows = workloadGrid(
      items.value.map((i) => { const s = i.snapshot(); return { ownerUserId: s.ownerUserId, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd, status: s.status }; }),
      ids.map((id) => ({ userId: id, capacity: caps.value.get(id) ?? null })),
      weeks,
    );
    return ok({ weeks, rows });
  }
}

/** Sets how many activities a person can lead in a week. Managers only; blank clears it. Audited. */
export class SetCapacityHandler {
  constructor(private readonly capacity: IMemberCapacityRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, userId: string, input: { activitiesPerWeek: number | null }): Promise<Result<void, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const value = parseCapacity(input.activitiesPerWeek === null ? "" : String(input.activitiesPerWeek));
    if (!value.ok) return err(DomainError.validation(value.message, { field: "activitiesPerWeek" }));
    const saved = await this.capacity.set(userId, value.value, { userId: ctx.tenant.userId, now: this.clock.now() }, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.capacity_set", entityType: "user", entityId: userId,
      newValue: JSON.stringify({ activitiesPerWeek: value.value }),
    });
    return ok(undefined);
  }
}
