import type { Result, TenantId, DomainError, ReportPlanSection } from "@donordesk/domain";
import type { TemplateGenerationContext } from "./reporting.js";
import type {
  DonorTemplate,
  TemplateSection,
  TemplateRegion,
  TemplateRequirements,
  TemplateVersionSnapshot,
  ExtractionMeta,
} from "@donordesk/domain";

export interface TemplateVersionSummary {
  version: number;
  createdAt: Date;
  createdById: string;
  changeNote?: string;
}

export interface IDonorTemplateRepository {
  /** Persists the template and a snapshot of its current version. */
  create(t: DonorTemplate): Promise<Result<DonorTemplate>>;
  /** Persists the template; snapshots the version when it is new. */
  update(t: DonorTemplate, meta?: { actorId?: string; changeNote?: string }): Promise<Result<DonorTemplate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<DonorTemplate | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<DonorTemplate[]>>;
  findLibrary(tenantId: TenantId): Promise<Result<DonorTemplate[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

/** Read side of template versioning (ISP: consumers that only need history). */
export interface IDonorTemplateVersionReader {
  findVersion(templateId: string, version: number, tenantId: TenantId): Promise<Result<TemplateVersionSnapshot | null>>;
  listVersions(templateId: string, tenantId: TenantId): Promise<Result<TemplateVersionSummary[]>>;
}

/**
 * Visual formatting of a line/paragraph, when the reader can see it. Templates
 * without heading styles show their hierarchy only through this (e.g. 14pt red
 * bold = level 1, 10pt bold = level 2), so it is the level signal of last resort.
 */
export interface TextStyle {
  /** Opaque signature; equal keys = same visual heading style. */
  key: string;
  /** Font size in points. */
  size?: number;
  bold?: boolean;
  /** Hex colour without '#'; undefined = automatic/black. */
  color?: string;
}

/** A structure-preserving view of an uploaded document. */
export type DocumentBlock =
  | { kind: "HEADING"; level: number; text: string; page?: number; style?: TextStyle }
  | { kind: "PARAGRAPH"; text: string; emphasis?: boolean; page?: number; style?: TextStyle }
  | { kind: "LIST_ITEM"; text: string; ordered: boolean; depth: number; page?: number }
  | { kind: "TABLE"; rows: string[][]; page?: number };

export type StructuredDocumentFormat = "DOCX" | "PDF" | "XLSX" | "CSV" | "TEXT";

export interface StructuredDocument {
  format: StructuredDocumentFormat;
  blocks: DocumentBlock[];
  pageCount?: number;
}

export interface IStructuredDocumentParser {
  supports(input: { fileName: string; mimeType: string }): boolean;
  parse(input: { buffer: Buffer; fileName: string; mimeType: string }): Promise<Result<StructuredDocument, DomainError>>;
}

export interface TemplateExtractionRequest {
  tenantId: TenantId;
  rawText: string;
  /** Present when the original file could be parsed with structure. */
  document?: StructuredDocument;
  language: string;
  donorName?: string;
  reportType?: string;
}

export interface TemplateExtractionResult {
  sections: TemplateSection[];
  requirements: TemplateRequirements;
  meta: ExtractionMeta;
  summary: string;
}

/**
 * Extracts a donor template's report structure (sections, per-section donor
 * instructions and questions, required tables) and template-level requirements
 * (annexes, compliance, formatting, submission) from its content.
 */
export interface ITemplateExtractionService {
  extract(request: TemplateExtractionRequest): Promise<Result<TemplateExtractionResult, DomainError>>;
}

export interface StoredTemplateFile {
  key: string;
  fileName: string;
  mimeType: string;
  sha256: string;
}

/** Stores and reads back original uploaded template files, scoped per tenant. */
export interface ITemplateFileStore {
  save(input: { tenantId: TenantId; fileName: string; mimeType: string; buffer: Buffer }): Promise<Result<StoredTemplateFile, DomainError>>;
  /** Fails with forbidden when the key does not belong to the tenant. */
  open(key: string, tenantId: TenantId): Promise<Result<StoredTemplateFile & { buffer: Buffer }, DomainError>>;
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

/** Renders the exact section brief the AI writer receives (for human preview). */
export interface ISectionBriefRenderer {
  renderSection(section: ReportPlanSection): string;
  renderTemplate(template: TemplateGenerationContext): string;
}
