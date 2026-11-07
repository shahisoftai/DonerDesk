import { DomainError, type Result, type SkippedBlock } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IInfographicRenderer } from "../../ports/infographics.js";
import type { InfographicRenderService } from "../infographics/infographic-render.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";
import { renderCanvasFile, type CanvasFileFormat } from "./render-canvas-file.js";

export const CANVAS_EXPORT_FORMATS = ["PNG", "PDF", "SVG", "PPTX", "PACK"] as const;
export type CanvasExportFormat = CanvasFileFormat;
export interface CanvasFileDto { bytes: Buffer; contentType: string; fileName: string; skipped: SkippedBlock[] }

/**
 * Makes a file of a saved canvas for the person asking, from the records they can see. Blocks a file cannot hold are listed in `skipped`,
 * never left out silently, and the file is made again every time (this does not publish or keep a copy: see `PublishCanvasHandler`).
 */
export class ExportCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly render: InfographicRenderService, private readonly renderer: IInfographicRenderer) {}

  async handle(ctx: AuthenticatedContext, id: string, input: { format: CanvasExportFormat; scale?: 1 | 2 | 3 }): Promise<Result<CanvasFileDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    const file = await renderCanvasFile(ctx, { render: this.render, renderer: this.renderer }, found.value, input.format, input.scale);
    if (!file.ok) return file;
    return ok({ bytes: file.value.bytes, contentType: file.value.contentType, fileName: file.value.fileName, skipped: file.value.skipped });
  }
}
