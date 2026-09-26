import type { Result, TenantId } from "@donordesk/domain";
import type { DonorTemplate, TemplateSection, TemplateRegion } from "@donordesk/domain";

export interface IDonorTemplateRepository {
  create(t: DonorTemplate): Promise<Result<DonorTemplate>>;
  update(t: DonorTemplate): Promise<Result<DonorTemplate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<DonorTemplate | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<DonorTemplate[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface ITemplateExtractionService {
  extractSections(input: {
    rawText: string;
    language: string;
    existingSections?: TemplateSection[];
  }): Promise<{ sections: TemplateSection[]; summary: string }>;
}

/**
 * Parses the structural layout (headings, tables) of an uploaded donor
 * template DOCX so regions can be auto-mapped to DonorDesk report sections.
 * Distinct from `ITemplateExtractionService` (which extracts flat text for
 * AI section suggestion) — this preserves document structure instead.
 */
export interface IDonorTemplateStructureParser {
  parseStructure(input: { buffer: Buffer; fileName: string }): Promise<{ regions: TemplateRegion[] }>;
}

/**
 * Renders a donor's own uploaded template with report content populated
 * into it (docxtpl, worker-backed). `insertPlaceholders` runs once at
 * mapping-approval time; `render` runs on every export against the cached
 * templated bytes.
 */
export interface IDonorTemplateRenderer {
  insertPlaceholders(input: {
    originalDocxBuffer: Buffer;
    regions: Array<{ id: string; kind: "HEADING" | "TABLE"; order: number; placeholderKey: string }>;
  }): Promise<Result<{ templatedDocxBuffer: Buffer }>>;

  render(input: {
    templatedDocxBuffer: Buffer;
    context: Record<string, string>;
  }): Promise<Result<{ renderedDocxBuffer: Buffer }>>;
}
