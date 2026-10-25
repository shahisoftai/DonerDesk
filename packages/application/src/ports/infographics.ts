import type { TenantId, Result } from "@donordesk/domain";

/** A saved infographic composition (Phase 31) — config JSON, never project data. */
export interface InfographicRecord {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  templateId: string;
  templateVersion: number;
  configJson: string;
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** One published rendering (PNG | PDF). The bytes live in storage; the row keeps inputs + provenance. */
export interface InfographicExportRecord {
  id: string;
  tenantId: string;
  infographicId: string;
  projectId: string;
  format: "PNG" | "PDF";
  storageKey: string;
  sizeBytes: number;
  snapshotJson: string;
  provenanceJson: string;
  generatedById: string;
  createdAt: Date;
}

export interface IInfographicRepository {
  create(record: InfographicRecord): Promise<Result<InfographicRecord>>;
  update(record: InfographicRecord): Promise<Result<InfographicRecord>>;
  findById(id: string, tenantId: TenantId): Promise<Result<InfographicRecord | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<InfographicRecord[]>>;
  remove(id: string, tenantId: TenantId): Promise<Result<void>>;

  addExport(record: InfographicExportRecord): Promise<Result<InfographicExportRecord>>;
  findExportById(id: string, tenantId: TenantId): Promise<Result<InfographicExportRecord | null>>;
  findExportsByInfographic(infographicId: string, tenantId: TenantId): Promise<Result<InfographicExportRecord[]>>;
}

/**
 * Renders a validated composition against project data. Implemented in infrastructure (ECharts SSR
 * + sharp for PNG, pdfkit for PDF); application code depends only on this port and never on the
 * rendering libraries. Deterministic: identical inputs produce identical bytes.
 */
export interface InfographicRenderInput {
  configJson: string;
  /** The enriched project read (periods, indicators with location views, reach, activities, finance). */
  dataJson: string;
  /** The Data Center sheet, for CHART sections (the existing chart engine draws from it). */
  sheetJson: string;
  /** Site pins resolved client-side (no server-side gazetteer): name, coordinates, signal colour. */
  mapPointsJson: string;
  /** The organization's display name for the header (the logo, when present, is fetched by the renderer). */
  organizationName: string;
  logoUrl?: string;
  provenanceJson: string;
}

export interface IInfographicRenderer {
  renderPng(input: InfographicRenderInput): Promise<Result<Buffer>>;
  renderPdf(input: InfographicRenderInput): Promise<Result<Buffer>>;
}

/** The organization's display name and logo for the export header (read-only). */
export interface IOrganizationBrandReader {
  brandFor(tenantId: TenantId): Promise<Result<{ name: string; logoUrl?: string }>>;
}
