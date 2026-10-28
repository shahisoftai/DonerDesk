import type { AdminLevel, DatasetBudgetLine, DatasetDay, DatasetPlace, DatasetPlanRow, Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IBudgetExpenseReader, IBudgetLineReader } from "../ports/workplan.js";
import type { IPlaceRepository } from "../ports/places.js";
import type { PlaceResultsDto } from "../use-cases/places/place-results.js";
import type { WorkPlanRowDto } from "../use-cases/workplan/work-plan-row.js";

/**
 * The data a chart can ask for besides the data sheet (Phase 34): the work plan, completed activities by day, and the budget. Each is
 * read through the ordinary readers, for a project the caller can already see (the dataset handler checks that first). A source that
 * cannot be read is `undefined`, never empty: the chart then says it is not available rather than drawing nothing.
 */
export interface IDatasetExtras {
  plan(ctx: AuthenticatedContext, projectId: string): Promise<DatasetPlanRow[] | undefined>;
  activityDays(ctx: AuthenticatedContext, projectId: string): Promise<DatasetDay[] | undefined>;
  budget(ctx: AuthenticatedContext, projectId: string): Promise<DatasetBudgetLine[] | undefined>;
  /** One indicator's value in each place at a level of the places list (pins included); undefined when it cannot be read. */
  places(ctx: AuthenticatedContext, projectId: string, indicatorId: string, level: number): Promise<DatasetPlace[] | undefined>;
}

export class DatasetExtrasService implements IDatasetExtras {
  constructor(
    private readonly listPlan: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<WorkPlanRowDto[], DomainError>> },
    private readonly activities: Pick<IActivityUpdateRepository, "findByProject">,
    private readonly budgets: IBudgetLineReader & IBudgetExpenseReader,
    private readonly placeResults?: { handle(ctx: AuthenticatedContext, projectId: string, level: AdminLevel): Promise<Result<PlaceResultsDto, DomainError>> },
    private readonly placeList?: Pick<IPlaceRepository, "list">,
  ) {}

  async plan(ctx: AuthenticatedContext, projectId: string): Promise<DatasetPlanRow[] | undefined> {
    const rows = await this.listPlan.handle(ctx, projectId);
    if (!rows.ok) return undefined;
    return rows.value.map((r) => ({ id: r.id, title: r.title, kind: r.kind, start: r.plannedStart, end: r.plannedEnd, status: r.status, signal: r.signal, signalLabel: r.signalLabel }));
  }

  /** Accepted (completed and approved) activities counted on the day they happened; one that spans days counts on its first day. */
  async activityDays(ctx: AuthenticatedContext, projectId: string): Promise<DatasetDay[] | undefined> {
    const found = await this.activities.findByProject(projectId, ctx.tenant.tenantId);
    if (!found.ok) return undefined;
    const counts = new Map<string, number>();
    for (const a of found.value) {
      if (a.status !== "ACCEPTED") continue;
      const day = a.activityDate.toISOString().slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts].map(([date, count]) => ({ date, count })).sort((x, y) => x.date.localeCompare(y.date));
  }

  /** Budget lines with what is booked against each, in major units (amounts are kept in minor units, hundredths). */
  async budget(ctx: AuthenticatedContext, projectId: string): Promise<DatasetBudgetLine[] | undefined> {
    const lines = await this.budgets.findLinesByProject(projectId, ctx.tenant.tenantId);
    if (!lines.ok) return undefined;
    if (lines.value.length === 0) return [];
    const expenses = await this.budgets.findExpensesByLines(lines.value.map((l) => l.id), ctx.tenant.tenantId);
    if (!expenses.ok) return undefined;
    const spent = new Map<string, number>();
    for (const e of expenses.value) spent.set(e.budgetLineId, (spent.get(e.budgetLineId) ?? 0) + e.amountMinor);
    return lines.value.map((l) => ({ donor: l.donorName, category: l.category, currency: l.currency, budgeted: l.amountMinor / 100, spent: (spent.get(l.id) ?? 0) / 100 }));
  }

  /**
   * An indicator's recorded values by place at a level, from the same read the Data Center's "By place" uses (so a place's figure here is
   * the one the Data Center shows): what can be added is added, a rate is shown for the place that recorded it and never combined, a
   * place with nothing recorded has no value (never 0). Pins come from the places list.
   */
  async places(ctx: AuthenticatedContext, projectId: string, indicatorId: string, level: number): Promise<DatasetPlace[] | undefined> {
    if (!this.placeResults || !this.placeList) return undefined;
    const lvl = Math.max(0, Math.min(4, Math.trunc(level))) as AdminLevel;
    const result = await this.placeResults.handle(ctx, projectId, lvl);
    if (!result.ok) return undefined;
    const indicator = result.value.indicators.find((i) => i.id === indicatorId);
    if (!indicator) return [];
    const list = await this.placeList.list(ctx.tenant.tenantId);
    const byId = new Map((list.ok ? list.value : []).map((p) => [p.id, p]));
    return indicator.rollup.rows.map((r) => {
      const n = r.value === null ? null : Number.parseFloat(r.value.replace(/,/g, ""));
      const place = byId.get(r.placeId);
      return { name: r.name, path: r.path, level: r.adminLevel, value: n !== null && Number.isFinite(n) ? n : null, partly: r.partly, ...(place?.latitude !== undefined && place?.longitude !== undefined ? { latitude: place.latitude, longitude: place.longitude } : {}) };
    });
  }
}
