import { DomainError, canvasToWidgets, definitionFor, isDashboardKind, projectOf, type BlockModel, type Canvas, type DataSheet, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import { ShareLinkExtras, type IShareMapReader } from "../../services/share-link-extras.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";
import { drawCharts, type DashboardChartDto } from "../dashboards/dashboard-handlers.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { GetProjectInfographicDataHandler } from "../infographics/infographic-data.js";
import { fail, ok } from "./canvas-shared.js";
import { canvasFactsFor } from "./resolve-canvas.js";

export interface PublicCanvasDto { title: string; canvas: Canvas; drawings: DashboardChartDto[]; models: Record<string, BlockModel<unknown>> }
const unavailable = (reason: string): BlockModel<unknown> => ({ state: "unavailable", reason });

/**
 * What a LIVE link holder sees: the canvas drawn now from the records, as an outside guest. Finance never goes out, a list of the
 * organisation's projects and the portfolio are not shown, and nothing names a person. Only the projects the canvas itself names are read.
 */
export class PublicCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly info: GetProjectInfographicDataHandler, private readonly extras?: IDatasetExtras, private readonly maps?: IShareMapReader) {}

  async handle(tenantId: TenantId, canvasId: string): Promise<Result<PublicCanvasDto, DomainError>> {
    const found = await this.repo.findById(canvasId, tenantId);
    if (!found.ok || !found.value) return fail(DomainError.notFound("Canvas", "unavailable"));
    const stored = found.value;
    const guest: AuthenticatedContext = { tenant: { tenantId, userId: "share-link", role: "VIEWER", external: true } as never, requestId: "share-link" };
    const { widgets, withoutProject } = canvasToWidgets(stored.canvas, stored.projectId);
    const drawings = await drawCharts(widgets, async (projectId) => {
      const sheet = await this.sheets.handle(guest, projectId);
      return sheet.ok ? ({ ...sheet.value, finance: [], registerFinance: undefined, financeEnabled: false } as DataSheet) : null;
    }, this.extras ? { ctx: guest, service: new ShareLinkExtras(this.extras) } : undefined, undefined, this.maps ? { maps: this.maps } : undefined);
    const models: Record<string, BlockModel<unknown>> = {};
    for (const id of withoutProject) models[id] = unavailable("This block has no project.");
    const facts = new Map<string, ReturnType<typeof canvasFactsFor>>();
    for (const page of stored.canvas.pages) for (const block of page.blocks) {
      // A repeater is shown on screen only: a link never lists the organisation's projects, so what a repeater holds is not drawn through one.
      if (block.style?.hidden || isDashboardKind(block.kind) || models[block.id] || block.container) continue;
      const def = definitionFor(block.kind) as unknown as { reads?: string; resolve(p: unknown, d: unknown): BlockModel<unknown> } | undefined;
      if (!def) continue;
      if (def.reads !== "FACTS" && def.reads !== undefined) { models[block.id] = unavailable("This block is not shown through a link."); continue; }
      let data: unknown;
      if (def.reads === "FACTS") {
        const pid = projectOf(block.bindings) ?? stored.projectId;
        if (!pid) { models[block.id] = unavailable("This block has no project."); continue; }
        if (!facts.has(pid)) facts.set(pid, canvasFactsFor(this.sheets, this.info, guest, pid, stored.canvas, stored.title));
        const f = await facts.get(pid);
        data = f ? { ...f, finance: { enabled: false, rows: [] }, sheet: { ...f.sheet, finance: [], registerFinance: undefined } } : undefined;
      }
      models[block.id] = def.resolve(block.props, data);
    }
    return ok({ title: stored.title, canvas: { ...stored.canvas, id: stored.id, title: stored.title }, drawings, models });
  }
}
