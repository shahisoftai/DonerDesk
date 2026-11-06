import { collectionOwner, formatShortDate, ok, openCollection, type Assignment } from "@donordesk/domain";
import type { AssignmentQuery, ICollectionFactsReader, IAssignmentSource } from "@donordesk/application";
import { urgencyFor } from "./urgency.js";

/**
 * Indicator values someone is waiting for: due a few days after a period ends, owned by the indicator's lead (else the M&E
 * officer, else the manager). An indicator not due this period is never listed. Uses the same rule as the health label.
 */
export class IndicatorValueAssignmentSource implements IAssignmentSource {
  readonly kind = "INDICATOR_VALUE" as const;
  constructor(private readonly reader: ICollectionFactsReader) {}

  async list(q: AssignmentQuery) {
    const facts = await this.reader.forProjects(q.tenantId, q.projectId ? [q.projectId] : undefined);
    if (!facts.ok) return facts;
    const out: Assignment[] = [];
    for (const c of facts.value) {
      const periodById = new Map(c.periods.map((p) => [p.id, p]));
      for (const open of openCollection({ projectStart: c.projectStart, dueDays: c.dueDays, indicators: c.indicators, periods: c.periods, recorded: c.recorded, today: q.today })) {
        const owner = collectionOwner(open.indicator, c);
        if (!owner || (q.assigneeId && owner !== q.assigneeId)) continue;
        const period = periodById.get(open.periodId)!;
        out.push({
          key: `INDICATOR_VALUE:${open.indicatorId}:${open.periodId}`, kind: "INDICATOR_VALUE", projectId: c.projectId, projectTitle: c.projectTitle,
          title: `${open.indicator.code} ${open.indicator.name}: value for ${formatShortDate(period.start, q.today)} to ${formatShortDate(period.end, q.today)}`,
          assigneeId: owner, dueDate: open.dueBy, state: open.state === "OVERDUE" ? "LATE" : "OPEN", urgent: false,
          href: `/projects/${c.projectId}/reports/${open.periodId}/inputs`, urgency: urgencyFor(open.dueBy, q.today, 6),
        });
      }
    }
    return ok(out);
  }
}
