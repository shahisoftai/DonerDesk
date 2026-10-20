import { DomainError, NO_DELIVERY, localDate, toPlainDate, ok, type Result } from "@donordesk/domain";
import type { ListWorkPlanQuery } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import { toWorkPlanRow, type WorkPlanRowDto } from "./work-plan-row.js";
import type { IDeliveryFactsReader, IPlanContextReader, IPlanDependencyRepository, IPlannedActivityRepository } from "../../ports/workplan.js";

/** Items with their derived delivery state, filtered. Read-only: `project.view`, already enforced by the route table. */
export class ListWorkPlanHandler {
  constructor(
    private readonly repo: IPlannedActivityRepository, private readonly facts: IDeliveryFactsReader, private readonly context: IPlanContextReader, private readonly clock: IClock,
    private readonly dependencies?: IPlanDependencyRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, query: ListWorkPlanQuery = {}): Promise<Result<WorkPlanRowDto[], DomainError>> {
    const items = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const facts = await this.facts.factsByPlannedActivity(projectId, ctx.tenant.tenantId);
    if (!facts.ok) return facts;
    const covered = await this.context.reportCoveredRanges(projectId, ctx.tenant.tenantId);
    if (!covered.ok) return covered;
    // "Today" is read in the project's own time zone (else the organisation's); without the reader it is the UTC day.
    const zone = this.context.timeZoneFor ? await this.context.timeZoneFor(projectId, ctx.tenant.tenantId) : undefined;
    const today = zone?.ok ? localDate(this.clock.now(), zone.value) : toPlainDate(this.clock.now())!;
    const links = this.dependencies ? await this.dependencies.findByProject(projectId, ctx.tenant.tenantId) : ok([]);
    if (!links.ok) return links;
    const byId = new Map(items.value.map((i) => [i.id, i]));
    const finished = (id: string) => ["DONE", "CANCELLED"].includes(byId.get(id)?.status ?? "");
    const rows = items.value
      .filter((i) => !query.status || i.status === query.status)
      .filter((i) => !query.ownerId || i.ownerUserId === query.ownerId || i.supportUserIds.includes(query.ownerId))
      .filter((i) => !query.outputId || i.snapshot().outputId === query.outputId)
      .filter((i) => (!query.from || i.plannedEnd >= query.from) && (!query.to || i.plannedStart <= query.to))
      .map((i) => {
        const row = toWorkPlanRow(i, facts.value.get(i.id) ?? NO_DELIVERY, today, covered.value.some((r) => r.start <= i.plannedEnd && r.end >= i.plannedStart));
        const after = links.value.filter((l) => l.successorId === i.id).map((l) => ({ id: l.predecessorId, title: byId.get(l.predecessorId)?.title ?? "", finished: finished(l.predecessorId) }));
        const before = links.value.filter((l) => l.predecessorId === i.id).map((l) => ({ id: l.successorId, title: byId.get(l.successorId)?.title ?? "" }));
        return { ...row, comesAfter: after, comesBefore: before, waitingFor: after.filter((a) => !a.finished) };
      })
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.plannedEnd.localeCompare(b.plannedEnd) || a.title.localeCompare(b.title));
    return ok(rows);
  }
}
