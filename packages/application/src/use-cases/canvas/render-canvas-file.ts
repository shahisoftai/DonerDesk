import { DomainError, PORTFOLIO_PROJECT_ID, canvasAsDesign, knownTemplates, provenanceFooter, validateConfig, type InfographicProvenance, type Result, type SkippedBlock } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { StoredCanvas } from "../../ports/canvas.js";
import type { IInfographicRenderer } from "../../ports/infographics.js";
import type { InfographicRenderService } from "../infographics/infographic-render.js";
import { fail, ok } from "./canvas-shared.js";

export const FILE_FORMATS = ["PNG", "PDF", "SVG", "PPTX", "PACK"] as const;
export type CanvasFileFormat = (typeof FILE_FORMATS)[number];
export const FILE_TYPES: Record<CanvasFileFormat, { extension: string; contentType: string }> = {
  PNG: { extension: "png", contentType: "image/png" }, PDF: { extension: "pdf", contentType: "application/pdf" }, SVG: { extension: "svg", contentType: "image/svg+xml" },
  PPTX: { extension: "pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }, PACK: { extension: "zip", contentType: "application/zip" },
};

export interface RenderedCanvasFile { bytes: Buffer; contentType: string; fileName: string; extension: string; skipped: SkippedBlock[]; provenance: InfographicProvenance; configJson: string; pageCount: number }
export interface RenderDeps { render: InfographicRenderService; renderer: IInfographicRenderer }

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "canvas";

/** The one place a canvas becomes a file: it is turned into the design the renderer draws, built from the records the caller can see, and rendered. */
export async function renderCanvasFile(ctx: AuthenticatedContext, deps: RenderDeps, stored: StoredCanvas, format: CanvasFileFormat, scale: 1 | 2 | 3 = 2): Promise<Result<RenderedCanvasFile, DomainError>> {
  const portfolio = stored.canvas.scope === "PORTFOLIO";
  const projectId = portfolio ? PORTFOLIO_PROJECT_ID : stored.projectId;
  if (!projectId) return fail(DomainError.validation("Choose the project this canvas is about before making a file."));
  const design = canvasAsDesign({ ...stored.canvas, title: stored.title });
  if (design.config.sections.length === 0) return fail(DomainError.validation("Nothing on this canvas can be put in a file yet.", { skipped: design.skipped }));
  const validated = validateConfig(design.config, knownTemplates());
  if (!validated.ok) return validated;
  const built = await deps.render.build(ctx, projectId, validated.value, {});
  if (!built.ok) return built;
  const title = validated.value.title ?? stored.title;
  const sourcesNote = provenanceFooter(built.value.provenance, validated.value.language);
  const input = built.value.input;
  let bytes: Result<Buffer, DomainError>;
  let pageCount = 1;
  switch (format) {
    case "PNG": bytes = await deps.renderer.renderPng(input, scale); break;
    case "PDF": bytes = await deps.renderer.renderPdf(input, { altText: built.value.altText }); break;
    case "PPTX": bytes = await deps.renderer.renderPptx(input, { title, altText: built.value.altText, sourcesNote }); break;
    case "PACK": bytes = await deps.renderer.renderPack(input, { title, altText: built.value.altText, caption: title, sourcesNote }); break;
    case "SVG": { const pages = await deps.renderer.renderSvgPages(input); pageCount = pages.ok ? pages.value.length : 1; bytes = pages.ok ? ok(Buffer.from(pages.value[0]?.svg ?? "", "utf8")) : pages; break; }
  }
  if (!bytes.ok) return bytes;
  const type = FILE_TYPES[format];
  return ok({ bytes: bytes.value, contentType: type.contentType, extension: type.extension, fileName: `${slug(title)}.${type.extension}`, skipped: design.skipped, provenance: built.value.provenance, configJson: JSON.stringify(validated.value), pageCount });
}
