import { createHash, randomBytes } from "node:crypto";
import {
  restrictWidgetToPeriod, buildKpi, computeMetric, MAP_VIEW_LABEL, type KpiTile, type MetricTile,
  DomainError, Permissions, addWidget, projectListTable, buildChart, buildDataChart, canEditDashboard, canSeeDashboard, dashboardScopeProblem, datasetQueryFor, isSpecV2, resolveDataset, runReport, settleLayout, toDatasetQuery, validateReportQuery, widgetProblems, type ReportQuery,
  type ChartSpecV2, type DashboardScope, type DashboardWidget, type DataChartSpec, type DataSheet, type Result, type Role, type TenantId,
} from "@donordesk/domain";
import type { AddDashboardWidgetInput, CreateDashboardShareInput, SaveDashboardInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IDashboardLinkRepository, IDashboardRepository, StoredDashboard, StoredDashboardLink } from "../../ports/dashboards.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import { ShareLinkExtras, type IShareMapReader } from "../../services/share-link-extras.js";

/**
 * Dashboards of saved Data Center charts (Phase 33.8). A dashboard stores chart specs and positions only; the figures are drawn
 * from each project's data sheet every time it is opened. A chart whose project the viewer cannot see is shown as "not
 * available to you", never hidden and never drawn. Read-only share links draw the same charts without finance and without a
 * sign-in, for as long as the link lives.
 */

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export interface DashboardSummaryDto {
  id: string;
  name: string;
  scope: DashboardScope;
  projectId?: string;
  ownerId: string;
  mine: boolean;
  canEdit: boolean;
  chartCount: number;
  updatedAt: string;
}

export interface DashboardDto extends DashboardSummaryDto {
  widgets: DashboardWidget[];
}

const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: can(ctx, "project.edit") });

function summary(d: StoredDashboard, ctx: AuthenticatedContext): DashboardSummaryDto {
  return {
    id: d.id, name: d.name, scope: d.scope, ...(d.projectId ? { projectId: d.projectId } : {}), ownerId: d.ownerId, mine: d.ownerId === ctx.tenant.userId,
    canEdit: canEditDashboard(d, viewerOf(ctx)), chartCount: d.widgets.length, updatedAt: d.updatedAt.toISOString(),
  };
}

async function load(repo: IDashboardRepository, ctx: AuthenticatedContext, id: string): Promise<Result<StoredDashboard, DomainError>> {
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  // A personal dashboard that is not yours does not exist as far as you can tell.
  if (!found.value || !canSeeDashboard(found.value, viewerOf(ctx))) return fail(DomainError.notFound("Dashboard", id));
  return ok(found.value);
}

export class ListDashboardsHandler {
  constructor(private readonly repo: IDashboardRepository) {}

  async handle(ctx: AuthenticatedContext, projectId?: string): Promise<Result<DashboardSummaryDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards"));
    const listed = await this.repo.listVisible(ctx.tenant.tenantId, ctx.tenant.userId, projectId);
    if (!listed.ok) return listed;
    return ok(listed.value.filter((d) => canSeeDashboard(d, viewerOf(ctx))).map((d) => summary(d, ctx)));
  }
}

export class GetDashboardHandler {
  constructor(private readonly repo: IDashboardRepository) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<DashboardDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards"));
    const d = await load(this.repo, ctx, id);
    if (!d.ok) return d;
    return ok({ ...summary(d.value, ctx), widgets: d.value.widgets });
  }
}

export class SaveDashboardHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDashboardRepository, private readonly visible: VisibleProjects, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: SaveDashboardInput, dashboardId?: string): Promise<Result<{ id: string; updatedAt: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot save dashboards"));
    const scopeProblem = dashboardScopeProblem({ scope: input.scope, ownerId: ctx.tenant.userId, projectId: input.projectId });
    if (scopeProblem) return fail(DomainError.validation(scopeProblem));
    const widgets = settleLayout(input.widgets as unknown as DashboardWidget[]);
    const problems = widgetProblems(widgets);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message, { problems }));

    // A chart can only come from a project the saver can see: a dashboard is not a way to name someone else's project.
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const allowed = new Set(mine.value.map((p) => p.id));
    if (input.projectId && !allowed.has(input.projectId)) return fail(DomainError.notFound("Project", input.projectId));
    for (const w of widgets) if (!allowed.has(w.projectId)) return fail(DomainError.notFound("Project", w.projectId));

    const now = this.clock.now();
    if (!dashboardId) {
      if (input.scope !== "MINE" && !can(ctx, "project.edit")) return fail(DomainError.forbidden("Only someone who manages projects can make a shared dashboard"));
      const id = this.ids.generate();
      const created = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, scope: input.scope, ...(input.projectId ? { projectId: input.projectId } : {}), ownerId: ctx.tenant.userId, name: input.name.trim(), widgets, createdAt: now, updatedAt: now });
      if (!created.ok) return created;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.created", entityType: "dashboard", entityId: id });
      return ok({ id, updatedAt: now.toISOString() });
    }

    const existing = await load(this.repo, ctx, dashboardId);
    if (!existing.ok) return existing;
    if (!canEditDashboard(existing.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this dashboard"));
    if (existing.value.scope !== input.scope || existing.value.projectId !== input.projectId) return fail(DomainError.validation("A dashboard keeps the scope it was made with."));
    const expected = input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : undefined;
    const { projectId: _keep, ...base } = existing.value;
    const saved = await this.repo.update({ ...base, ...(existing.value.projectId ? { projectId: existing.value.projectId } : {}), name: input.name.trim(), widgets, updatedAt: now }, expected);
    if (!saved.ok) return saved;
    if (!saved.value) return fail(DomainError.conflict("Someone else has changed this dashboard since you opened it. Nothing was saved. Reload the page to see their version, then make your changes again."));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.updated", entityType: "dashboard", entityId: dashboardId });
    return ok({ id: dashboardId, updatedAt: now.toISOString() });
  }
}

/** Adds one chart (from the Data Center) to a dashboard the person can change; it lands below the others. */
export class AddDashboardWidgetHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDashboardRepository, private readonly visible: VisibleProjects, private readonly clock: IClock, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, dashboardId: string, input: AddDashboardWidgetInput): Promise<Result<{ chartCount: number }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot save dashboards"));
    const d = await load(this.repo, ctx, dashboardId);
    if (!d.ok) return d;
    if (!canEditDashboard(d.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this dashboard"));
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === input.projectId)) return fail(DomainError.notFound("Project", input.projectId));
    if (d.value.scope === "PROJECT" && d.value.projectId !== input.projectId) return fail(DomainError.validation("A project dashboard holds charts from its own project only."));
    const widgets = addWidget(d.value.widgets, { id: this.ids.generate().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40), projectId: input.projectId, ...(input.map ? { kind: "MAP" as const, map: input.map } : input.metric ? { kind: "METRIC" as const, metric: input.metric } : input.kpi ? { kind: "KPI" as const, kpi: input.kpi } : input.report ? { kind: "REPORT" as const, report: input.report as unknown as ReportQuery, ...(input.title ? { text: input.title } : {}) } : { spec: input.spec as unknown as DataChartSpec | ChartSpecV2 }) });
    if (!widgets) return fail(DomainError.conflict("This dashboard is full. Remove a chart first."));
    const problems = widgetProblems(widgets);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message, { problems }));
    const saved = await this.repo.update({ ...d.value, widgets, updatedAt: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.chart_added", entityType: "dashboard", entityId: dashboardId });
    return ok({ chartCount: widgets.length });
  }
}

export class DeleteDashboardHandler {
  constructor(private readonly repo: IDashboardRepository, private readonly links: IDashboardLinkRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot delete dashboards"));
    const d = await load(this.repo, ctx, id);
    if (!d.ok) return d;
    if (!canEditDashboard(d.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot delete this dashboard"));
    // Its share links go with it: a link to a deleted dashboard must not keep answering.
    const gone = await this.links.deleteByDashboard(id, ctx.tenant.tenantId);
    if (!gone.ok) return gone;
    const removed = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.deleted", entityType: "dashboard", entityId: id });
    return ok(undefined);
  }
}

export interface DashboardChartDto {
  widgetId: string;
  /** Present when the chart could be drawn. */
  chart?: { option: Record<string, unknown>; title: string; notes: string[]; unverified: number; points: number; /** Map names the screen registers before drawing. */ maps?: string[]; regionNames?: string[] };
  /** A table kind (pivot, scorecard): the rows to show instead of a picture. */
  table?: { title: string; columns: string[]; rows: Array<Array<string | null>>; notes: string[] };
  /** A KPI tile: the latest figure, its share of target and a sparkline. */
  kpi?: KpiTile;
  /** A coloured number tile: a money or activity figure. */
  metric?: MetricTile;
  /** An interactive map: the screen draws it, for the viewer, from their own access (nothing is sent here). */
  map?: { view: "RESULTS" | "ACTIVITIES"; title: string; projectId: string; /** Only on a share link: the data the card shows, read on the server because a link holder has no session. */ preloaded?: Record<string, unknown> };
  /** A text block. */
  text?: string;
  /** Why it is not drawn: not available to this viewer, or the chart's own reason (an indicator was removed). */
  unavailable?: string;
}

/** Draws every chart of a set of widgets from the projects' data sheets. One sheet read per project, however many charts. */
export async function drawCharts(
  widgets: ReadonlyArray<DashboardWidget>,
  readSheet: (projectId: string) => Promise<DataSheet | null>,
  /** The plan, activity days and budget, read for this caller; absent for a share link, which never shows them. */
  extras?: { ctx: AuthenticatedContext; service: IDatasetExtras },
  /** The viewer's own period for this visit; the saved dashboard is not changed. */
  viewerPeriodId?: string,
  /** Present only for a share link: maps are drawn from data read here, and lists of projects are not shown. */
  share?: { maps: IShareMapReader },
): Promise<DashboardChartDto[]> {
  const sheets = new Map<string, DataSheet | null>();
  for (const w of widgets) if (!sheets.has(w.projectId)) sheets.set(w.projectId, await readSheet(w.projectId));
  const shown = viewerPeriodId ? widgets.map((w) => restrictWidgetToPeriod(w, viewerPeriodId, sheets.get(w.projectId)?.periods.map((p) => p.id))) : widgets;
  // Extra data is read once per project and source, however many charts use it.
  const cache = new Map<string, Promise<unknown>>();
  const extra = <T,>(key: string, read: () => Promise<T>): Promise<T> => { if (!cache.has(key)) cache.set(key, read()); return cache.get(key) as Promise<T>; };
  const dataFor = async (w: DashboardWidget, sheet: DataSheet, spec: ChartSpecV2) => {
    const data = resolveDataset(sheet, datasetQueryFor(spec, sheet.indicators.map((i) => i.id)));
    const source = datasetQueryFor(spec, []).sources?.[0];
    if (source && extras) {
      const { ctx, service } = extras;
      if (source === "PLAN") data.plan = await extra(`${w.projectId}|plan`, () => service.plan(ctx, w.projectId));
      if (source === "ACTIVITY_DAYS") data.activityDays = await extra(`${w.projectId}|days`, () => service.activityDays(ctx, w.projectId));
      if (source === "BUDGET") data.budget = await extra(`${w.projectId}|budget`, () => service.budget(ctx, w.projectId));
      if (source === "PLACES") {
        const indicatorId = spec.dataset.indicatorIds[0] ?? "";
        const level = spec.dataset.placeLevel ?? 1;
        data.places = await extra(`${w.projectId}|places|${indicatorId}|${level}`, () => service.places(ctx, w.projectId, indicatorId, level));
      }
    }
    return data;
  };
  return Promise.all(shown.map(async (w): Promise<DashboardChartDto> => {
    if (w.kind === "TEXT") return { widgetId: w.id, text: w.text ?? "" };
    if (w.kind === "PROJECT_LIST") {
      if (!w.projectList) return { widgetId: w.id, unavailable: "This list has no filters." };
      // The list is made for the person opening the dashboard (the projects they can see); a share link has no such person and shows none.
      if (!extras || share) return { widgetId: w.id, unavailable: "Project lists are not shown through a share link." };
      const sources = await extra("visible-projects", () => extras.service.visibleProjects(extras.ctx));
      if (!sources) return { widgetId: w.id, unavailable: "The projects could not be read just now." };
      const starred = w.projectList.affiliation === "BOOKMARKED" ? await extra("bookmarked-projects", () => extras.service.bookmarkedProjectIds(extras.ctx)) : undefined;
      return { widgetId: w.id, table: projectListTable(sources, w.projectList, extras.ctx.tenant.userId, starred) };
    }
    const sheet = sheets.get(w.projectId);
    if (!sheet) return { widgetId: w.id, unavailable: "This chart is from a project you cannot see." };
    if (w.kind === "MAP") {
      if (!w.map) return { widgetId: w.id, unavailable: "This map has no settings." };
      // A map reads recorded values and the plan as the person opening the dashboard: it is never drawn for a share link (no extras there).
      if (!extras) return { widgetId: w.id, unavailable: "Maps are not shown through a share link." };
      const title = w.map.title?.trim() || MAP_VIEW_LABEL[w.map.view];
      if (share && extras) {
        const gx = extras.ctx;
        if (w.map.view === "RESULTS") {
          const [places, results] = await Promise.all([share.maps.places(gx), share.maps.results(gx, w.projectId)]);
          if (places === undefined || results === undefined) return { widgetId: w.id, unavailable: "This map could not be read just now." };
          return { widgetId: w.id, map: { view: w.map.view, title, projectId: w.projectId, preloaded: { places, results } } };
        }
        const activities = await share.maps.activities(gx, w.projectId);
        if (!activities) return { widgetId: w.id, unavailable: "This map could not be read just now." };
        return { widgetId: w.id, map: { view: w.map.view, title, projectId: w.projectId, preloaded: activities as unknown as Record<string, unknown> } };
      }
      return { widgetId: w.id, map: { view: w.map.view, title, projectId: w.projectId } };
    }
    if (w.kind === "METRIC") {
      if (!w.metric) return { widgetId: w.id, unavailable: "This tile has no figure." };
      // Money and the plan are read for the caller and never through a share link (no extras there): the tile then says so, it is not drawn empty.
      const grp = w.metric.metric.startsWith("FIN_") ? "FINANCE" : "PLAN";
      const plan = grp === "PLAN" && extras ? await extra(`${w.projectId}|plan`, () => extras.service.plan(extras.ctx, w.projectId)) : undefined;
      const finance = grp === "FINANCE" && extras ? await extra(`${w.projectId}|finance`, () => extras.service.finance(extras.ctx, w.projectId)) : undefined;
      return { widgetId: w.id, metric: computeMetric(w.metric, { plan, finance }) };
    }
    if (w.kind === "KPI") {
      if (!w.kpi) return { widgetId: w.id, unavailable: "This tile has no indicator." };
      const k = buildKpi(sheet, w.kpi);
      return k.ok ? { widgetId: w.id, kpi: k.tile } : { widgetId: w.id, unavailable: k.reason };
    }
    if (w.kind === "REPORT") {
      // A saved report: the question is run against the sheet now, so the table cannot be out of date.
      if (!w.report || validateReportQuery(w.report).length > 0) return { widgetId: w.id, unavailable: "This report's question is not valid." };
      const t = runReport(resolveDataset(sheet, toDatasetQuery(w.report)), w.report);
      return { widgetId: w.id, table: { title: w.text?.trim() || "Report", columns: t.columns, rows: t.rows.map((r) => [r.label, ...r.cells.map((c) => c ?? "Not measured")]), notes: t.notes } };
    }
    if (isSpecV2(w.spec)) {
      // A Chart Studio chart: the same builder the studio draws with, from the same sheet, so a dashboard shows what the studio showed.
      const spec = w.spec as ChartSpecV2;
      const built = buildChart(spec, await dataFor(w, sheet, spec));
      if (!built.ok) return { widgetId: w.id, unavailable: built.reason };
      if (built.render === "TABLE") return { widgetId: w.id, table: { title: built.title, columns: built.columns, rows: built.rows, notes: built.notes } };
      return { widgetId: w.id, chart: { option: built.option, title: built.title, notes: built.notes, unverified: built.provenance.unverified, points: built.provenance.points, ...(built.maps ? { maps: built.maps } : {}), ...(built.regionNames ? { regionNames: built.regionNames } : {}) } };
    }
    if (!w.spec) return { widgetId: w.id, unavailable: "This chart has no settings." };
    const drawn = buildDataChart(sheet, w.spec as DataChartSpec);
    if (!drawn.ok) return { widgetId: w.id, unavailable: drawn.reason };
    return { widgetId: w.id, chart: { option: drawn.option, title: drawn.title, notes: drawn.notes, unverified: drawn.provenance.unverified, points: drawn.provenance.points } };
  }));
}

type DashboardPeriod = { projectId: string; id: string; label: string };

/** Reads a project's sheet for the viewer (only the projects they may see) and notes its periods. The one reader both handlers draw through. */
function viewerSheetReader(ctx: AuthenticatedContext, sheets: GetProjectDataSheetHandler, allowed: ReadonlySet<string>, periods: DashboardPeriod[]) {
  return async (projectId: string): Promise<DataSheet | null> => {
    if (!allowed.has(projectId)) return null;
    const sheet = await sheets.handle(ctx, projectId);
    if (!sheet.ok) return null;
    for (const p of sheet.value.periods) periods.push({ projectId, id: p.id, label: p.label });
    return sheet.value;
  };
}

export class GetDashboardDataHandler {
  constructor(private readonly repo: IDashboardRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly visible: VisibleProjects, private readonly extras?: IDatasetExtras) {}

  async handle(ctx: AuthenticatedContext, id: string, options: { periodId?: string } = {}): Promise<Result<{ charts: DashboardChartDto[]; periods: DashboardPeriod[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards"));
    const d = await load(this.repo, ctx, id);
    if (!d.ok) return d;
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    // The periods of the projects the viewer may see: what the dashboard's period filter offers.
    const periods: DashboardPeriod[] = [];
    const charts = await drawCharts(d.value.widgets, viewerSheetReader(ctx, this.sheets, new Set(mine.value.map((p) => p.id)), periods), this.extras ? { ctx, service: this.extras } : undefined, options.periodId);
    return ok({ charts, periods });
  }
}

/**
 * Draws widgets that are not saved yet (a tile just added or changed in edit mode), so it appears at once with its real figures.
 * The same drawing, for the same viewer, under the same visibility rules as a saved dashboard; nothing is stored and nothing is audited.
 */
export class PreviewDashboardChartsHandler {
  constructor(private readonly sheets: GetProjectDataSheetHandler, private readonly visible: VisibleProjects, private readonly extras?: IDatasetExtras) {}

  async handle(ctx: AuthenticatedContext, widgets: ReadonlyArray<DashboardWidget>, options: { periodId?: string } = {}): Promise<Result<{ charts: DashboardChartDto[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards"));
    // A size outside the grid is fitted, not refused, exactly as a save does it; then the rest is checked.
    const fitted = settleLayout([...widgets]);
    const problems = widgetProblems(fitted);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message));
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const charts = await drawCharts(fitted, viewerSheetReader(ctx, this.sheets, new Set(mine.value.map((p) => p.id)), []), this.extras ? { ctx, service: this.extras } : undefined, options.periodId);
    return ok({ charts });
  }
}

export interface DashboardLinkDto { id: string; label: string; expiresAt: string; live: boolean; revoked: boolean }

export class CreateDashboardShareHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDashboardRepository, private readonly links: IDashboardLinkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** The token is shown once; only its hash is stored. */
  async handle(ctx: AuthenticatedContext, dashboardId: string, input: CreateDashboardShareInput): Promise<Result<{ id: string; token: string; expiresAt: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot share dashboards"));
    const d = await load(this.repo, ctx, dashboardId);
    if (!d.ok) return d;
    if (!canEditDashboard(d.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot share this dashboard"));
    const now = this.clock.now();
    const token = randomBytes(24).toString("base64url");
    const link: StoredDashboardLink = {
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId, dashboardId, label: input.label, tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000), createdById: ctx.tenant.userId, createdAt: now,
    };
    const saved = await this.links.create(link);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.share.created", entityType: "dashboard_share_link", entityId: link.id });
    return ok({ id: link.id, token, expiresAt: link.expiresAt.toISOString() });
  }
}

export class ListDashboardSharesHandler {
  constructor(private readonly repo: IDashboardRepository, private readonly links: IDashboardLinkRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, dashboardId: string): Promise<Result<DashboardLinkDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see share links"));
    const d = await load(this.repo, ctx, dashboardId);
    if (!d.ok) return d;
    if (!canEditDashboard(d.value, viewerOf(ctx))) return ok([]);
    const listed = await this.links.listByDashboard(dashboardId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    return ok(listed.value.map((l) => ({ id: l.id, label: l.label, expiresAt: l.expiresAt.toISOString(), revoked: l.revokedAt !== undefined, live: l.revokedAt === undefined && l.expiresAt > now })));
  }
}

export class RevokeDashboardShareHandler {
  constructor(private readonly repo: IDashboardRepository, private readonly links: IDashboardLinkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, linkId: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot revoke share links"));
    const link = await this.links.findById(linkId, ctx.tenant.tenantId);
    if (!link.ok) return link;
    if (!link.value) return fail(DomainError.notFound("Link", linkId));
    const d = await load(this.repo, ctx, link.value.dashboardId);
    if (!d.ok) return fail(DomainError.notFound("Link", linkId));
    if (!canEditDashboard(d.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot revoke this link"));
    const done = await this.links.revoke(linkId, ctx.tenant.tenantId, this.clock.now());
    if (!done.ok) return done;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard.share.revoked", entityType: "dashboard_share_link", entityId: linkId });
    return ok(undefined);
  }
}

/** Finds which dashboard (and organisation) a public link opens. Unknown, expired and revoked all look the same. */
export class ResolveDashboardShareHandler {
  constructor(private readonly links: IDashboardLinkRepository, private readonly clock: IClock) {}

  async handle(token: string): Promise<Result<{ tenantId: TenantId; dashboardId: string }, DomainError>> {
    const found = await this.links.findByTokenHash(sha256(token));
    if (!found.ok) return found;
    const link = found.value;
    if (!link || link.revokedAt || link.expiresAt <= this.clock.now()) return fail(DomainError.notFound("Link", "unavailable"));
    return ok({ tenantId: link.tenantId, dashboardId: link.dashboardId });
  }
}

/**
 * What a link holder sees: the dashboard's name and its charts, drawn now from the data sheets, without finance (a finance chart
 * reads "not available") and without anything that names a person. The reader is an outside guest, never a member.
 */
export class PublicDashboardHandler {
  /** `extras` and `maps` are what a link may show beyond indicator figures (see `ShareLinkExtras`); without them a link shows indicator charts only. */
  constructor(private readonly repo: IDashboardRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly extras?: IDatasetExtras, private readonly maps?: IShareMapReader) {}

  async handle(tenantId: TenantId, dashboardId: string): Promise<Result<{ name: string; widgets: DashboardWidget[]; charts: DashboardChartDto[] }, DomainError>> {
    const found = await this.repo.findById(dashboardId, tenantId);
    if (!found.ok || !found.value) return fail(DomainError.notFound("Dashboard", "unavailable"));
    const guest: AuthenticatedContext = { tenant: { tenantId, userId: "share-link", role: "VIEWER", external: true } as never, requestId: "share-link" };
    const charts = await drawCharts(found.value.widgets, async (projectId) => {
      const sheet = await this.sheets.handle(guest, projectId);
      if (!sheet.ok) return null;
      // Finance never goes out through a link.
      return { ...sheet.value, finance: [], registerFinance: undefined, financeEnabled: false } as DataSheet;
    }, this.extras ? { ctx: guest, service: new ShareLinkExtras(this.extras) } : undefined, undefined, this.maps ? { maps: this.maps } : undefined);
    return ok({ name: found.value.name, widgets: found.value.widgets, charts });
  }
}
