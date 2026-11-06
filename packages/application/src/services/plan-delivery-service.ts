import { summarizePlanDelivery, toPlainDate, type PlanDeliveryItem, type PlanDeliverySummary, type PlainDate, type Result, type TenantId } from "@donordesk/domain";
import type { IPlannedActivityRepository, IPlanRevisionRepository } from "../ports/workplan.js";

/** What the plan says about one period; undefined when nothing was planned for it. */
export interface IPlanDelivery {
  forPeriod(input: { tenantId: TenantId; projectId: string; start: Date | PlainDate; end: Date | PlainDate }): Promise<Result<PlanDeliverySummary | undefined>>;
}

/** Loads the project's plan once and summarises it for a period (`summarizePlanDelivery`); moved reasons come from the plan history. */
export class PlanDeliveryService implements IPlanDelivery {
  constructor(private readonly plans: IPlannedActivityRepository, private readonly revisions: IPlanRevisionRepository) {}

  async forPeriod(input: { tenantId: TenantId; projectId: string; start: Date | PlainDate; end: Date | PlainDate }): Promise<Result<PlanDeliverySummary | undefined>> {
    const start = toPlainDate(input.start);
    const end = toPlainDate(input.end);
    if (!start || !end) return { ok: true, value: undefined };
    const found = await this.plans.findByProject(input.projectId, input.tenantId);
    if (!found.ok) return found;
    const items: PlanDeliveryItem[] = [];
    for (const p of found.value) {
      const s = p.snapshot();
      let reason = s.status === "CANCELLED" ? s.statusReason : undefined;
      if (s.status !== "CANCELLED" && p.isMoved && s.plannedEnd >= start && s.plannedEnd <= end) {
        const history = await this.revisions.findByPlannedActivity(p.id, input.tenantId);
        if (history.ok) reason = [...history.value].reverse().find((r) => r.reason && (r.change.plannedStart || r.change.plannedEnd))?.reason;
      }
      items.push({ status: s.status, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd, moved: p.isMoved, ...(reason ? { reason } : {}) });
    }
    return { ok: true, value: summarizePlanDelivery(items, { start, end }) };
  }
}
