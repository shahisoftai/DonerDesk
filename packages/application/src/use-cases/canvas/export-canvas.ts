import { DomainError, PORTFOLIO_PROJECT_ID, canvasAsDesign, knownTemplates, provenanceFooter, validateConfig, type Result, type SkippedBlock } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IInfographicRenderer } from "../../ports/infographics.js";
import type { InfographicRenderService } from "../infographics/infographic-render.js";
import { can, fail, loadCanvas, ok } from "./canvas-shared.js";

export const CANVAS_EXPORT_FORMATS = ["PNG", "PDF", "SVG", "PPTX", "PACK"] as const;
export type CanvasExportFormat = (typeof CANVAS_EXPORT_FORMATS)[number];
const FILE: Record<CanvasExportFormat, { extension: string; contentType: string }> = {
  PNG: { extension: "png", contentType: "image/png" }, PDF: { extension: "pdf", contentType: "application/pdf" }, SVG: { extension: "svg", contentType: "image/svg+xml" },
  PPTX: { extension: "pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }, PACK: { extension: "zip", contentType: "application/zip" },
};

export interface CanvasFileDto { bytes: Buffer; contentType: string; fileName: string; skipped: SkippedBlock[] }

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "canvas";

/**
 * Makes a file of a saved canvas for the person asking, from the records they can see. Blocks a file cannot hold are listed in `skipped`,
 * never left out silently, and the file is made again every time (this does not publish or keep a copy).
 */
export class ExportCanvasHandler {
  constructor(private readonly repo: ICanvasRepository, private readonly render: InfographicRenderService, private readonly renderer: IInfographicRenderer) {}

  async handle(ctx: AuthenticatedContext, id: string, input: { format: CanvasExportFormat; scale?: 1 | 2 | 3 }): Promise<Result<CanvasFileDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards or infographics"));
    const found = await loadCanvas(this.repo, ctx, id);
    if (!found.ok) return found;
    const stored = found.value;
    const portfolio = stored.canvas.scope === "PORTFOLIO";
    const projectId = portfolio ? PORTFOLIO_PROJECT_ID : stored.projectId;
    if (!projectId) return fail(DomainError.validation("Choose the project this canvas is about before making a file."));
    const design = canvasAsDesign({ ...stored.canvas, title: stored.title });
    if (design.config.sections.length === 0) return fail(DomainError.validation("Nothing on this canvas can be put in a file yet.", { skipped: design.skipped }));
    const validated = validateConfig(design.config, knownTemplates());
    if (!validated.ok) return validated;
    const built = await this.render.build(ctx, projectId, validated.value, {});
    if (!built.ok) return built;
    const title = validated.value.title ?? stored.title;
    const sourcesNote = provenanceFooter(built.value.provenance, validated.value.language);
    const scale = input.scale ?? 2;
    let bytes: Result<Buffer, DomainError>;
    switch (input.format) {
      case "PNG": bytes = await this.renderer.renderPng(built.value.input, scale); break;
      case "PDF": bytes = await this.renderer.renderPdf(built.value.input, { altText: built.value.altText }); break;
      case "PPTX": bytes = await this.renderer.renderPptx(built.value.input, { title, altText: built.value.altText, sourcesNote }); break;
      case "PACK": bytes = await this.renderer.renderPack(built.value.input, { title, altText: built.value.altText, caption: title, sourcesNote }); break;
      case "SVG": {
        const pages = await this.renderer.renderSvgPages(built.value.input);
        bytes = pages.ok ? ok(Buffer.from(pages.value[0]?.svg ?? "", "utf8")) : pages;
        break;
      }
    }
    if (!bytes.ok) return bytes;
    const file = FILE[input.format];
    return ok({ bytes: bytes.value, contentType: file.contentType, fileName: `${slug(title)}.${file.extension}`, skipped: design.skipped });
  }
}
