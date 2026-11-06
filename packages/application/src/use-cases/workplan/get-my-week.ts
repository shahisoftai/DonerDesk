import { DomainError, NO_DELIVERY, addDays, ok, toPlainDate, type PlainDate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IDeliveryFactsReader, IMyWeekReader, MyWeekSentBack } from "../../ports/workplan.js";
import { toWorkPlanRow, type WorkPlanRowDto } from "./work-plan-row.js";

export type MyWeekItemDto = Omit<WorkPlanRowDto, "reasonRequired"> & { projectId: string; projectTitle: string };

export interface MyWeekDto {
  today: PlainDate;
  /** Monday of this week. */
  weekStart: PlainDate;
  planned: MyWeekItemDto[];
  sentBack: MyWeekSentBack[];
}

const mondayOf = (d: PlainDate): PlainDate => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/**
 * A field officer's landing read, in one call: their own open planned activities (late, this week, next week) and the
 * completed activities a reviewer sent back. Always about the caller; there is no way to ask for another person's week.
 */
export class GetMyWeekHandler {
  constructor(private readonly reader: IMyWeekReader, private readonly facts: IDeliveryFactsReader, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<MyWeekDto, DomainError>> {
    const today = toPlainDate(this.clock.now())!;
    const weekStart = mondayOf(today);
    const open = await this.reader.openPlannedFor(ctx.tenant.userId, ctx.tenant.tenantId, addDays(weekStart, 13));
    if (!open.ok) return open;
    const sentBack = await this.reader.sentBackFor(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!sentBack.ok) return sentBack;

    const projectIds = [...new Set(open.value.map((o) => o.item.projectId))];
    const factsByProject = new Map<string, Awaited<ReturnType<IDeliveryFactsReader["factsByPlannedActivity"]>>>();
    for (const id of projectIds) factsByProject.set(id, await this.facts.factsByPlannedActivity(id, ctx.tenant.tenantId));

    const planned: MyWeekItemDto[] = [];
    for (const { item, projectTitle } of open.value) {
      const facts = factsByProject.get(item.projectId)!;
      if (!facts.ok) return facts;
      const { reasonRequired: _unused, ...row } = toWorkPlanRow(item, facts.value.get(item.id) ?? NO_DELIVERY, today, false);
      planned.push({ ...row, projectId: item.projectId, projectTitle });
    }
    planned.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title));
    return ok({ today, weekStart, planned, sentBack: sentBack.value });
  }
}
