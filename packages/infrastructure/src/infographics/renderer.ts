import { DomainError, ok, templateById } from "@donordesk/domain";
import type { Result, TenantId, InfographicConfig, InfographicProvenance, DataSheet } from "@donordesk/domain";
import type { ProjectInfographicDataDto } from "@donordesk/application";
import PDFDocument from "pdfkit";
import type {
  IInfographicRenderer,
  IOrganizationBrandReader,
  InfographicRenderInput,
} from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";
import { composeInfographicPages, rasterizePage } from "./composer.js";

interface ParsedRenderInput {
  config: InfographicConfig;
  data: ProjectInfographicDataDto;
  sheet: DataSheet;
  provenance: InfographicProvenance;
  mapPoints: Array<{ name: string; lat: number; lng: number; worst: string; count?: number }>;
}

const parse = (input: InfographicRenderInput): Result<ParsedRenderInput, DomainError> => {
  try {
    const parsed = {
      config: JSON.parse(input.configJson) as InfographicConfig,
      data: JSON.parse(input.dataJson) as ProjectInfographicDataDto,
      sheet: JSON.parse(input.sheetJson) as DataSheet,
      provenance: JSON.parse(input.provenanceJson) as InfographicProvenance,
      mapPoints: JSON.parse(input.mapPointsJson) as ParsedRenderInput["mapPoints"],
    };
    return ok(parsed);
  } catch {
    return { ok: false, error: DomainError.validation("The infographic inputs are not readable") };
  }
};

/**
 * Renders infographics with the shared chart engine (ECharts SSR) through sharp for PNG and pdfkit
 * for PDF. One composition at a time (sharp is native and heavy); re-exports of unchanged designs
 * hit the chart PNG cache and are fast. Deterministic: identical inputs produce identical bytes.
 */
export class InfographicComposerRenderer implements IInfographicRenderer {
  async renderPng(input: InfographicRenderInput): Promise<Result<Buffer, DomainError>> {
    const parsed = parse(input);
    if (!parsed.ok) return parsed;
    const templateLabel = templateLabelOf(parsed.value.config);
    const pages = await composeInfographicPages({
      config: parsed.value.config,
      data: parsed.value.data,
      sheet: parsed.value.sheet,
      provenance: parsed.value.provenance,
      mapPoints: parsed.value.mapPoints,
      organizationName: input.organizationName,
      ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      templateLabel,
    });
    if (pages.length === 0) return { ok: false, error: DomainError.validation("This design has nothing to render") };
    // Page 1 only for PNG: the fixed-canvas share image.
    return ok(await rasterizePage(pages[0]!));
  }

  async renderPdf(input: InfographicRenderInput): Promise<Result<Buffer, DomainError>> {
    const parsed = parse(input);
    if (!parsed.ok) return parsed;
    const templateLabel = templateLabelOf(parsed.value.config);
    const pages = await composeInfographicPages({
      config: parsed.value.config,
      data: parsed.value.data,
      sheet: parsed.value.sheet,
      provenance: parsed.value.provenance,
      mapPoints: parsed.value.mapPoints,
      organizationName: input.organizationName,
      ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      templateLabel,
    });
    if (pages.length === 0) return { ok: false, error: DomainError.validation("This design has nothing to render") };
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: parsed.value.config.title ?? templateLabel, Author: "DonorDesk" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => doc.on("end", resolve));
    for (const [index, svg] of pages.entries()) {
      if (index > 0) doc.addPage();
      const png = await rasterizePage(svg);
      doc.image(png, 0, 0, { width: doc.page.width, height: doc.page.height });
    }
    doc.end();
    await done;
    return ok(Buffer.concat(chunks));
  }
}

function templateLabelOf(config: InfographicConfig): string {
  return templateById(config.templateId)?.label ?? config.templateId;
}

/** The organization's name and logo, read straight from the tenant row (no separate aggregate yet). */
export class PrismaOrganizationBrandReader implements IOrganizationBrandReader {
  constructor(private readonly prisma: PrismaClient) {}

  async brandFor(tenantId: TenantId): Promise<Result<{ name: string; logoUrl?: string }, DomainError>> {
    const row = await this.prisma.organization.findUnique({ where: { id: tenantId.toString() }, select: { name: true, logoUrl: true } });
    if (!row) return { ok: false, error: DomainError.notFound("Organization", tenantId.toString()) };
    return ok({ name: row.name, ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}) });
  }
}
