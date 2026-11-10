import type { AdminLevel, DatasetBudgetLine, DatasetDay, DatasetFlow, DatasetPlace, DatasetPlanRow, MetricFinanceFigures, Project, ProjectListSource, Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IBudgetExpenseReader, IBudgetLineReader } from "../ports/workplan.js";
import type { IPlaceRepository } from "../ports/places.js";
import type { IPlaceFlowRepository } from "../ports/place-flows.js";
import type { ILogframeRepository } from "../ports/logframe.js";
import type { IBookmarkRepository } from "../ports/dashboards.js";
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
  /** The movements recorded between the project's places, with where each end is; undefined when they cannot be read or are not offered (a share link). */
  flows?(ctx: AuthenticatedContext, projectId: string): Promise<DatasetFlow[] | undefined>;
  /** A project's finance figures (obligated, received, spent), for number tiles; undefined when the caller may not see them. */
  finance(ctx: AuthenticatedContext, projectId: string): Promise<MetricFinanceFigures | undefined>;
  /** The projects the caller can see, for a project-list tile; undefined when they cannot be read. */
  visibleProjects(ctx: AuthenticatedContext): Promise<ProjectListSource[] | undefined>;
  /** The ids of the projects the caller has starred (their own bookmarks to a project page). */
  bookmarkedProjectIds(ctx: AuthenticatedContext): Promise<Set<string>>;
}

export class DatasetExtrasService implements IDatasetExtras {
  constructor(
    private readonly listPlan: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<WorkPlanRowDto[], DomainError>> },
    private readonly activities: Pick<IActivityUpdateRepository, "findByProject">,
    private readonly budgets: IBudgetLineReader & IBudgetExpenseReader,
    private readonly placeResults?: { handle(ctx: AuthenticatedContext, projectId: string, level: AdminLevel): Promise<Result<PlaceResultsDto, DomainError>> },
    private readonly placeList?: Pick<IPlaceRepository, "list">,
    private readonly outputs?: Pick<ILogframeRepository, "findByProject">,
    private readonly projectFinance?: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<MetricFinanceFigures, DomainError>> },
    private readonly visible?: { for(ctx: AuthenticatedContext): Promise<Result<Project[], DomainError>> },
    private readonly bookmarks?: Pick<IBookmarkRepository, "listForUser">,
    private readonly placeFlows?: Pick<IPlaceFlowRepository, "listByProject">,
  ) {}

  async flows(ctx: AuthenticatedContext, projectId: string): Promise<DatasetFlow[] | undefined> {
    if (!this.placeFlows || !this.placeList) return undefined;
    const [listed, places] = await Promise.all([this.placeFlows.listByProject(ctx.tenant.tenantId, projectId), this.placeList.list(ctx.tenant.tenantId, { includeArchived: true })]);
    if (!listed.ok || !places.ok) return undefined;
    const byId = new Map(places.value.map((p) => [p.id, p]));
    return listed.value.map((f) => {
      const a = byId.get(f.fromPlaceId), b = byId.get(f.toPlaceId);
      return { from: a?.name ?? "A place", to: b?.name ?? "A place", what: f.what, quantity: f.quantity, unit: f.unit, ...(a?.latitude !== undefined && a?.longitude !== undefined ? { fromLatitude: a.latitude, fromLongitude: a.longitude } : {}), ...(b?.latitude !== undefined && b?.longitude !== undefined ? { toLatitude: b.latitude, toLongitude: b.longitude } : {}) };
    });
  }

  async bookmarkedProjectIds(ctx: AuthenticatedContext): Promise<Set<string>> {
    if (!this.bookmarks) return new Set();
    const r = await this.bookmarks.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return new Set();
    const ids = new Set<string>();
    for (const b of r.value) { const m = /^\/projects\/([^/?#]+)/.exec(b.href); if (m) ids.add(m[1]!); }
    return ids;
  }

  async visibleProjects(ctx: AuthenticatedContext): Promise<ProjectListSource[] | undefined> {
    if (!this.visible) return undefined;
    const r = await this.visible.for(ctx);
    if (!r.ok) return undefined;
    return r.value.filter((p) => !p.archivedAt).map((p) => ({ projectId: p.id, title: p.title, status: String(p.status), sector: String(p.sector ?? ""), country: p.country, donorName: p.donorName, managerId: p.projectManagerId, meOfficerId: p.meOfficerId, reportingOfficerId: p.reportingOfficerId }));
  }

  /** Obligated, received and spent from the finance register, through the same read the Finance tab uses (so a tile shows what the tab shows). */
  async finance(ctx: AuthenticatedContext, projectId: string): Promise<MetricFinanceFigures | undefined> {
    if (!this.projectFinance) return undefined;
    const f = await this.projectFinance.handle(ctx, projectId);
    return f.ok ? { primaryCurrency: f.value.primaryCurrency, index: f.value.index, inPrimary: f.value.inPrimary } : undefined;
  }

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

  /** null when the plan or the logframe could not be read (so a line's result is unknown, not "none"); an empty map when no logframe is wired. */
  private async resultsByActivity(ctx: AuthenticatedContext, projectId: string): Promise<Map<string, string> | null> {
    const out = new Map<string, string>();
    if (!this.outputs) return out;
    const [plan, items] = await Promise.all([this.listPlan.handle(ctx, projectId), this.outputs.findByProject(projectId, ctx.tenant.tenantId)]);
    if (!plan.ok || !items.ok) return null;
    const label = new Map(items.value.map((i) => [i.id, `${i.code ? `${i.code} ` : ""}${i.title}`.trim()]));
    for (const r of plan.value) if (r.outputId && label.get(r.outputId)) out.set(r.id, label.get(r.outputId)!);
    return out;
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
    // The result each line serves: its planned activity's output (an activity has at most one), named as the logframe names it.
    const resultOf = await this.resultsByActivity(ctx, projectId);
    return lines.value.map((l) => ({ donor: l.donorName, category: l.category, currency: l.currency, budgeted: l.amountMinor / 100, spent: (spent.get(l.id) ?? 0) / 100, ...(resultOf === null ? { resultUnknown: true as const } : resultOf.get(l.plannedActivityId) ? { result: resultOf.get(l.plannedActivityId)! } : {}) }));
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
