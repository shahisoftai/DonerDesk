import { DomainError, canvasToWidgets, definitionFor, isDashboardKind, type BlockModel, type CanvasFacts, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { DashboardChartDto, PreviewDashboardChartsHandler } from "../dashboards/dashboard-handlers.js";
import type { GetProjectInfographicDataHandler } from "../infographics/infographic-data.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

export interface ResolvedCanvasDto {
  canvasId: string;
  /** Chart-style blocks (indicator and number tiles, maps, charts, tables), drawn by the dashboards' own code; keyed by `widgetId` = block id. */
  drawings: DashboardChartDto[];
  /** Every other block's model, keyed by block id: the one thing the screen and a file are both painted from. */
  models: Record<string, BlockModel<unknown>>;
}

const unavailable = (reason: string): BlockModel<unknown> => ({ state: "unavailable", reason });

export class ResolveCanvasHandler {
  constructor(
    private readonly repo: ICanvasRepository, private readonly preview: PreviewDashboardChartsHandler, private readonly sheets: GetProjectDataSheetHandler,
    private readonly infographicData: GetProjectInfographicDataHandler, private readonly visible: VisibleProjects, private readonly extras?: IDatasetExtras,
  ) {}

  /** Reads what a canvas shows, for the person looking, under their own access: a project they cannot see yields "unavailable" blocks, never someone else's figures. */
  async handle(ctx: AuthenticatedContext, id: string, options: { periodId?: string } = {}): Promise<Result<ResolvedCanvasDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    const stored = found.value;
    const { widgets, withoutProject } = canvasToWidgets(stored.canvas, stored.projectId);
    const models: Record<string, BlockModel<unknown>> = {};
    for (const blockId of withoutProject) models[blockId] = unavailable("Choose the project this block reads.");

    let drawings: DashboardChartDto[] = [];
    if (widgets.length > 0) {
      const drawn = await this.preview.handle(ctx, widgets, options);
      if (!drawn.ok) return drawn;
      drawings = drawn.value.charts;
    }

    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const allowed = new Set(mine.value.map((p) => p.id));
    const facts = stored.projectId && allowed.has(stored.projectId) ? await this.factsFor(ctx, stored.projectId, stored.canvas.options) : undefined;
    const list = await this.projectList(ctx);

    for (const page of stored.canvas.pages) for (const block of page.blocks) {
      if (block.style?.hidden || isDashboardKind(block.kind) || models[block.id]) continue;
      const def = definitionFor(block.kind) as unknown as { reads?: "FACTS" | "VIEWER_PROJECTS"; resolve(props: unknown, data: unknown): BlockModel<unknown> } | undefined;
      if (!def) { models[block.id] = unavailable("This block is not one the product knows."); continue; }
      models[block.id] = def.resolve(block.props, def.reads === "VIEWER_PROJECTS" ? list : def.reads === "FACTS" ? facts : undefined);
    }
    return ok({ canvasId: id, drawings, models });
  }

  /** The figures an infographic-style block reads, taken from the same records the Data Center and the Studio read. */
  private async factsFor(ctx: AuthenticatedContext, projectId: string, options: { periodFromId?: string | undefined; periodToId?: string | undefined; locationKeys?: string[] | undefined; acknowledgement?: string | undefined } | undefined): Promise<CanvasFacts | undefined> {
    const [sheet, data] = await Promise.all([this.sheets.handle(ctx, projectId), this.infographicData.handle(ctx, projectId)]);
    if (!sheet.ok || !data.ok) return undefined;
    return {
      sheet: sheet.value, reach: data.value.reach, activities: data.value.activities, finance: data.value.finance, indicators: data.value.indicators,
      range: { fromId: options?.periodFromId, toId: options?.periodToId }, locationKeys: options?.locationKeys, acknowledgement: options?.acknowledgement,
    };
  }

  private async projectList(ctx: AuthenticatedContext) {
    if (!this.extras) return undefined;
    const projects = await this.extras.visibleProjects(ctx);
    if (!projects) return undefined;
    return { projects, userId: ctx.tenant.userId, bookmarkedIds: [...(await this.extras.bookmarkedProjectIds(ctx))] };
  }
}
