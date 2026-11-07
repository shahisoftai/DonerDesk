import { DomainError, canvasToWidgets, definitionFor, isDashboardKind, portfolioOnlyFacts, projectOf, type BlockModel, type Canvas, type CanvasFacts, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { DashboardChartDto, PreviewDashboardChartsHandler } from "../dashboards/dashboard-handlers.js";
import type { GetProjectInfographicDataHandler } from "../infographics/infographic-data.js";
import type { GetPortfolioInfographicDataHandler } from "../infographics/portfolio-data.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

/** What a viewer may narrow a canvas by without changing it: a period and/or places. */
export interface CanvasFilterOptions { periodId?: string | undefined; placeKeys?: string[] | undefined }

export interface ResolvedCanvasDto {
  canvasId: string;
  /** Chart-style blocks (indicator and number tiles, maps, charts, tables), drawn by the dashboards' own code; keyed by `widgetId` = block id. */
  drawings: DashboardChartDto[];
  /** Every other block's model, keyed by block id: the one thing the screen and a file are both painted from. */
  models: Record<string, BlockModel<unknown>>;
  /** What the viewer can narrow the canvas by (the periods and places of its project); empty when it has none. */
  choices: { periods: Array<{ id: string; label: string }>; places: Array<{ key: string; label: string }> };
}

const unavailable = (reason: string): BlockModel<unknown> => ({ state: "unavailable", reason });

export class ResolveCanvasHandler {
  constructor(
    private readonly repo: ICanvasRepository, private readonly preview_: PreviewDashboardChartsHandler, private readonly sheets: GetProjectDataSheetHandler,
    private readonly infographicData: GetProjectInfographicDataHandler, private readonly visible: VisibleProjects, private readonly extras?: IDatasetExtras,
    private readonly portfolio?: GetPortfolioInfographicDataHandler,
  ) {}

  /** Reads what a saved canvas shows, for the person looking, under their own access: a project they cannot see yields "unavailable" blocks, never someone else's figures. */
  async handle(ctx: AuthenticatedContext, id: string, options: CanvasFilterOptions = {}): Promise<Result<ResolvedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    return this.resolveDocument(ctx, { id, canvas: found.value.canvas, projectId: found.value.projectId, title: found.value.title }, options);
  }

  /** Reads what an edited, unsaved canvas would show, so an edit is seen before it is saved. Nothing is stored; the reads are the same, under the same access. */
  async preview(ctx: AuthenticatedContext, doc: { canvas: Canvas; projectId: string | undefined; title: string }, options: CanvasFilterOptions = {}): Promise<Result<ResolvedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    return this.resolveDocument(ctx, { id: "preview", ...doc }, options);
  }

  private async resolveDocument(ctx: AuthenticatedContext, stored: { id: string; canvas: Canvas; projectId: string | undefined; title: string }, options: CanvasFilterOptions): Promise<Result<ResolvedCanvasDto, DomainError>> {
    const id = stored.id;
    const { widgets, withoutProject } = canvasToWidgets(stored.canvas, stored.projectId);
    const models: Record<string, BlockModel<unknown>> = {};
    for (const blockId of withoutProject) models[blockId] = unavailable("Choose the project this block reads.");

    let drawings: DashboardChartDto[] = [];
    if (widgets.length > 0) {
      const drawn = await this.preview_.handle(ctx, widgets, options);
      if (!drawn.ok) return drawn;
      drawings = drawn.value.charts;
    }

    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const allowed = new Set(mine.value.map((p) => p.id));
    // Each block reads the project it names, else its canvas's; the facts of a project are read once however many blocks use them.
    const factsByProject = new Map<string, Promise<CanvasFacts | undefined>>();
    const factsOf = (projectId: string | undefined): Promise<CanvasFacts | undefined> => {
      if (!projectId || !allowed.has(projectId)) return Promise.resolve(undefined);
      if (!factsByProject.has(projectId)) factsByProject.set(projectId, canvasFactsFor(this.sheets, this.infographicData, ctx, projectId, stored.canvas, stored.title, options));
      return factsByProject.get(projectId)!;
    };
    const list = await this.projectList(ctx);
    const portfolio = await this.portfolioFacts(ctx, stored.canvas);

    for (const page of stored.canvas.pages) for (const block of page.blocks) {
      if (block.style?.hidden || isDashboardKind(block.kind) || models[block.id]) continue;
      const def = definitionFor(block.kind) as unknown as { reads?: "FACTS" | "VIEWER_PROJECTS" | "PORTFOLIO"; resolve(props: unknown, data: unknown): BlockModel<unknown> } | undefined;
      if (!def) { models[block.id] = unavailable("This block is not one the product knows."); continue; }
      let data: unknown;
      if (def.reads === "VIEWER_PROJECTS") data = list;
      else if (def.reads === "PORTFOLIO") data = portfolio ? portfolioOnlyFacts(portfolio) : undefined;
      else if (def.reads === "FACTS") {
        const facts = await factsOf(projectOf(block.bindings) ?? stored.projectId);
        // A figure block may count the portfolio (a "projects" card): the portfolio is added only when its settings ask.
        data = facts && portfolio && JSON.stringify(block.props).includes('"PORTFOLIO_') ? { ...facts, portfolio } : facts;
      }
      models[block.id] = def.resolve(block.props, data);
    }
    const home = await factsOf(stored.projectId);
    return ok({ canvasId: id, drawings, models, choices: home ? filterChoices(home) : { periods: [], places: [] } });
  }

  /** The portfolio, read once and only when some block on the canvas draws from it. */
  private async portfolioFacts(ctx: AuthenticatedContext, canvas: Canvas) {
    const wanted = canvas.pages.some((p) => p.blocks.some((b) => !b.style?.hidden && (definitionFor(b.kind) as { reads?: string } | undefined)?.reads === "PORTFOLIO" || JSON.stringify(b.props).includes('"PORTFOLIO_')));
    if (!wanted || !this.portfolio) return undefined;
    const read = await this.portfolio.handle(ctx);
    return read.ok ? read.value : undefined;
  }

  private async projectList(ctx: AuthenticatedContext) {
    if (!this.extras) return undefined;
    const projects = await this.extras.visibleProjects(ctx);
    if (!projects) return undefined;
    return { projects, userId: ctx.tenant.userId, bookmarkedIds: [...(await this.extras.bookmarkedProjectIds(ctx))] };
  }
}

/** The figures an infographic-style block reads, taken from the same records the Data Center and the Studio read. */
export async function canvasFactsFor(sheets: GetProjectDataSheetHandler, infographicData: GetProjectInfographicDataHandler, ctx: AuthenticatedContext, projectId: string, canvas: Canvas, title: string, filters: CanvasFilterOptions = {}): Promise<CanvasFacts | undefined> {
  const [sheet, data] = await Promise.all([sheets.handle(ctx, projectId), infographicData.handle(ctx, projectId)]);
  if (!sheet.ok || !data.ok) return undefined;
  const o = canvas.options;
  return {
    sheet: sheet.value, reach: data.value.reach, activities: data.value.activities, finance: data.value.finance, indicators: data.value.indicators,
    // A viewer's own filter narrows what the design chose: a period ends the range there, places replace the default places.
    range: { fromId: o?.periodFromId, toId: filters.periodId ?? o?.periodToId }, locationKeys: filters.placeKeys?.length ? filters.placeKeys : o?.locationKeys, acknowledgement: o?.acknowledgement, subtitle: o?.subtitle,
    project: { title: data.value.project.title, donorName: data.value.project.donorName, country: data.value.project.country }, designTitle: title,
  };
}

const MAX_PLACES = 40;
/** The periods and places a viewer may filter by: what the project's own records name. */
export function filterChoices(f: CanvasFacts): ResolvedCanvasDto["choices"] {
  const places = new Map<string, string>();
  for (const r of f.reach.registeredByLocation) places.set(r.key, r.location);
  for (const r of f.activities.rows) places.set(r.key, r.location);
  for (const i of f.indicators) if (i.location.kind === "ADDITIVE" || i.location.kind === "RECORDED") for (const r of i.location.rows) places.set(r.key, r.location);
  return { periods: f.sheet.periods.map((p) => ({ id: p.id, label: p.label })), places: [...places.entries()].slice(0, MAX_PLACES).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label)) };
}
