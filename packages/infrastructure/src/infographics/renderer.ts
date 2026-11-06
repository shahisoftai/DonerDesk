import { DomainError, ok, resolveFormat, templateById } from "@donordesk/domain";
import type { Result, TenantId, InfographicConfig, InfographicProvenance, DataSheet, OrganizationBrandKit } from "@donordesk/domain";
import type { PortfolioInfographicDataDto, ProjectInfographicDataDto } from "@donordesk/application";
import PptxModule from "pptxgenjs";
import type {
  IInfographicRenderer,
  IOrganizationBrandReader,
  InfographicPage,
  InfographicRasterScale,
  InfographicRenderInput,
} from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { composeInfographicDocument, rasterizePage, type InfographicComposeInput, type RenderAsset, type MapShapeInput } from "./composer.js";
import { beginStructure, drawSvg, endStructure, hasRightToLeftScript, inFigure, newPdf, withRenderSlot } from "./raster.js";

// pptxgenjs ships CommonJS; under NodeNext the class is the module's `default`.
const PptxGenJS = ((PptxModule as unknown as { default?: typeof PptxModule }).default ?? PptxModule) as unknown as new () => import("pptxgenjs").default;

interface ParsedRenderInput {
  config: InfographicConfig;
  data: ProjectInfographicDataDto;
  sheet: DataSheet;
  provenance: InfographicProvenance;
  mapPoints: Array<{ name: string; lat: number; lng: number; worst: string; count?: number }>;
  mapShapes: MapShapeInput[];
  assets: Record<string, RenderAsset>;
  brand?: OrganizationBrandKit;
  portfolio?: PortfolioInfographicDataDto;
}

const parse = (input: InfographicRenderInput): Result<ParsedRenderInput, DomainError> => {
  try {
    return ok({
      config: JSON.parse(input.configJson) as InfographicConfig,
      data: JSON.parse(input.dataJson) as ProjectInfographicDataDto,
      sheet: JSON.parse(input.sheetJson) as DataSheet,
      provenance: JSON.parse(input.provenanceJson) as InfographicProvenance,
      mapPoints: JSON.parse(input.mapPointsJson) as ParsedRenderInput["mapPoints"],
      mapShapes: input.mapShapesJson ? (JSON.parse(input.mapShapesJson) as MapShapeInput[]) : [],
      assets: input.assetsJson ? (JSON.parse(input.assetsJson) as Record<string, RenderAsset>) : {},
      ...(input.brandJson ? { brand: JSON.parse(input.brandJson) as OrganizationBrandKit } : {}),
      ...(input.portfolioJson ? { portfolio: JSON.parse(input.portfolioJson) as PortfolioInfographicDataDto } : {}),
    });
  } catch {
    return { ok: false, error: DomainError.validation("The infographic inputs are not readable") };
  }
};

/**
 * Renders infographics with the shared chart engine (ECharts SSR): resvg for PNG, svg-to-pdfkit for a
 * vector PDF, bundled fonts, no browser (see raster.ts). One render at a time on the single host.
 * Deterministic: identical inputs produce identical bytes.
 */
export class InfographicComposerRenderer implements IInfographicRenderer {
  private async compose(input: InfographicRenderInput): Promise<Result<{ pages: InfographicPage[]; title: string; config: InfographicConfig }, DomainError>> {
    const parsed = parse(input);
    if (!parsed.ok) return parsed;
    const templateLabel = templateLabelOf(parsed.value.config);
    const compose: InfographicComposeInput = {
      config: parsed.value.config,
      data: parsed.value.data,
      sheet: parsed.value.sheet,
      provenance: parsed.value.provenance,
      mapPoints: parsed.value.mapPoints,
      mapShapes: parsed.value.mapShapes,
      organizationName: input.organizationName,
      ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      templateLabel,
      assets: parsed.value.assets,
      ...(parsed.value.brand ? { brand: parsed.value.brand } : {}),
      ...(parsed.value.portfolio ? { portfolio: parsed.value.portfolio } : {}),
      ...(input.preview ? { preview: true } : {}),
    };
    const pages = await composeInfographicDocument(compose);
    if (pages.length === 0) return { ok: false, error: DomainError.validation("This design has nothing to render") };
    return ok({ pages, title: parsed.value.config.title ?? templateLabel, config: parsed.value.config });
  }

  async renderSvgPages(input: InfographicRenderInput): Promise<Result<InfographicPage[]>> {
    return withRenderSlot(async () => {
      const composed = await this.compose(input);
      return composed.ok ? ok(composed.value.pages) : composed;
    });
  }

  async renderPng(input: InfographicRenderInput, scale: InfographicRasterScale = 2): Promise<Result<Buffer>> {
    return withRenderSlot(async () => {
      const composed = await this.compose(input);
      if (!composed.ok) return composed;
      return ok(await rasterizePage(composed.value.pages[0]!.svg, scale));
    });
  }

  async renderPngPages(input: InfographicRenderInput, scale: InfographicRasterScale = 2): Promise<Result<Buffer[]>> {
    return withRenderSlot(async () => {
      const composed = await this.compose(input);
      if (!composed.ok) return composed;
      const out: Buffer[] = [];
      for (const page of composed.value.pages) out.push(await rasterizePage(page.svg, scale));
      return ok(out);
    });
  }

  /** A vector PDF (selectable text, bundled fonts). A page the vector writer cannot draw falls back to an image of that page. */
  async renderPdf(input: InfographicRenderInput, meta?: { altText?: string }): Promise<Result<Buffer>> {
    return withRenderSlot(async () => {
      const composed = await this.compose(input);
      if (!composed.ok) return composed;
      const paper = resolveFormat(composed.value.config.format).pdf;
      const doc = newPdf({ Title: composed.value.title, Author: "DonorDesk" }, paper, composed.value.config.language);
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      const done = new Promise<void>((resolve) => doc.on("end", resolve));
      const structure = beginStructure(doc);
      const total = composed.value.pages.length;
      for (const [index, page] of composed.value.pages.entries()) {
        if (index > 0) doc.addPage({ size: [paper.width, paper.height], margin: 0 });
        const alt = index === 0 && meta?.altText ? meta.altText : `${composed.value.title} (${index + 1}/${total})`;
        // A page with right-to-left script, or one the vector writer cannot draw, goes in as a picture of the page.
        let raster = hasRightToLeftScript(page.svg);
        if (!raster) {
          try {
            inFigure(doc, structure, alt, () => drawSvg(doc, page.svg, paper));
          } catch {
            raster = true;
          }
        }
        if (raster) {
          const png = await rasterizePage(page.svg, 2);
          inFigure(doc, structure, alt, () => void doc.image(png, 0, 0, { width: paper.width, height: paper.height }));
        }
      }
      endStructure(doc, structure);
      doc.end();
      await done;
      return ok(Buffer.concat(chunks));
    });
  }

  /** A ZIP for handing a design to a communications team: every page as PNG (1× and 2×), the PDF, the SVG pages, and the words that go with it. */
  async renderPack(input: InfographicRenderInput, meta: { title: string; altText: string; caption: string; sourcesNote: string }): Promise<Result<Buffer>> {
    const svg = await this.renderSvgPages(input);
    if (!svg.ok) return svg;
    const pdf = await this.renderPdf(input, { altText: meta.altText });
    if (!pdf.ok) return pdf;
    const x1 = await this.renderPngPages(input, 1);
    if (!x1.ok) return x1;
    const x2 = await this.renderPngPages(input, 2);
    if (!x2.ok) return x2;
    const zip = new JSZip();
    const FIXED = new Date("2000-01-01T00:00:00Z");
    const add = (path: string, data: string | Buffer): void => void zip.file(path, data, { date: FIXED });
    const many = svg.value.length > 1;
    const name = (i: number): string => (many ? `-${String(i + 1).padStart(2, "0")}` : "");
    add("infographic.pdf", pdf.value);
    x1.value.forEach((png, i) => add(`png-1x/infographic${name(i)}.png`, png));
    x2.value.forEach((png, i) => add(`png-2x/infographic${name(i)}.png`, png));
    svg.value.forEach((page, i) => add(`svg/infographic${name(i)}.svg`, page.svg));
    add("description.txt", `${meta.title}\n\n${meta.altText}\n`);
    add("caption.txt", `${meta.caption}\n`);
    add("sources.txt", `${meta.sourcesNote}\n`);
    // A fixed date keeps identical inputs byte-identical.
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 }, platform: "UNIX" });
    return ok(bytes);
  }

  /** One slide per page. Each slide is the page image (pictures keep every figure exactly as published); the notes carry the sources. */
  async renderPptx(input: InfographicRenderInput, meta: { title: string; altText: string; sourcesNote: string }): Promise<Result<Buffer>> {
    return withRenderSlot(async () => {
      const composed = await this.compose(input);
      if (!composed.ok) return composed;
      const first = composed.value.pages[0]!;
      const inchesW = 13.333;
      const inchesH = Math.round((inchesW * first.height) / first.width * 1000) / 1000;
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: "INFOGRAPHIC", width: inchesW, height: inchesH });
      pptx.layout = "INFOGRAPHIC";
      pptx.title = meta.title;
      pptx.author = "DonorDesk";
      for (const page of composed.value.pages) {
        const slide = pptx.addSlide();
        const png = await rasterizePage(page.svg, 2);
        slide.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0, y: 0, w: inchesW, h: (inchesW * page.height) / page.width, altText: meta.altText });
        slide.addNotes(`${meta.altText}\n\n${meta.sourcesNote}`);
      }
      const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
      return ok(Buffer.from(out));
    });
  }
}

function templateLabelOf(config: InfographicConfig): string {
  return templateById(config.templateId)?.label ?? config.templateId;
}

/** The organization's name and logo, read straight from the tenant row (no separate aggregate yet). */
export class PrismaOrganizationBrandReader implements IOrganizationBrandReader {
  constructor(private readonly prisma: PrismaClient) {}

  async brandFor(tenantId: TenantId): Promise<Result<{ name: string; logoUrl?: string }, DomainError>> {
    // The tenant id is the Organization's tenantId column, not its primary key.
    const row = await this.prisma.organization.findFirst({ where: { tenantId: tenantId.toString() }, select: { name: true, logoUrl: true } });
    if (!row) return { ok: false, error: DomainError.notFound("Organization", tenantId.toString()) };
    return ok({ name: row.name, ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}) });
  }
}
