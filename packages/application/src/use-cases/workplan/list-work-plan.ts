import { DomainError, NO_DELIVERY, toPlainDate, ok, type Result } from "@donordesk/domain";
import type { ListWorkPlanQuery } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import { toWorkPlanRow, type WorkPlanRowDto } from "./work-plan-row.js";
import type { IDeliveryFactsReader, IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";

/** Items with their derived delivery state, filtered. Read-only: `project.view`, already enforced by the route table. */
export class ListWorkPlanHandler {
  constructor(private readonly repo: IPlannedActivityRepository, private readonly facts: IDeliveryFactsReader, private readonly context: IPlanContextReader, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, query: ListWorkPlanQuery = {}): Promise<Result<WorkPlanRowDto[], DomainError>> {
    const items = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const facts = await this.facts.factsByPlannedActivity(projectId, ctx.tenant.tenantId);
    if (!facts.ok) return facts;
    const covered = await this.context.reportCoveredRanges(projectId, ctx.tenant.tenantId);
    if (!covered.ok) return covered;
    const today = toPlainDate(this.clock.now())!;
    const rows = items.value
      .filter((i) => !query.status || i.status === query.status)
      .filter((i) => !query.ownerId || i.ownerUserId === query.ownerId || i.supportUserIds.includes(query.ownerId))
      .filter((i) => !query.outputId || i.snapshot().outputId === query.outputId)
      .filter((i) => (!query.from || i.plannedEnd >= query.from) && (!query.to || i.plannedStart <= query.to))
      .map((i) => toWorkPlanRow(i, facts.value.get(i.id) ?? NO_DELIVERY, today, covered.value.some((r) => r.start <= i.plannedEnd && r.end >= i.plannedStart)))
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.plannedEnd.localeCompare(b.plannedEnd) || a.title.localeCompare(b.title));
    return ok(rows);
  }
}
