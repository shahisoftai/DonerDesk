import type { TenantId, Result, DesignStatus, OrganizationBrandKit } from "@donordesk/domain";

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
  status: DesignStatus;
  reviewRequestedById?: string;
  reviewRequestedAt?: Date;
  approvedById?: string;
  approvedAt?: Date;
  selfApproved: boolean;
  parentId?: string;
}

/** One published rendering (PNG | PDF). The bytes live in storage; the row keeps inputs + provenance. */
export interface InfographicExportRecord {
  id: string;
  tenantId: string;
  infographicId: string;
  projectId: string;
  format: InfographicExportFormat;
  storageKey: string;
  sizeBytes: number;
  snapshotJson: string;
  provenanceJson: string;
  generatedById: string;
  createdAt: Date;
  pageCount: number;
  approved: boolean;
  waivedJson?: string;
  altText?: string;
}

export type InfographicExportFormat = "PNG" | "PDF" | "SVG" | "PPTX" | "PACK";
export const INFOGRAPHIC_EXPORT_FORMATS: readonly InfographicExportFormat[] = ["PNG", "PDF", "SVG", "PPTX", "PACK"];

/** The file type and extension each published format is stored and served as. */
export const EXPORT_FILE: Readonly<Record<InfographicExportFormat, { contentType: string; extension: string }>> = {
  PNG: { contentType: "image/png", extension: "png" },
  PDF: { contentType: "application/pdf", extension: "pdf" },
  SVG: { contentType: "image/svg+xml", extension: "svg" },
  PPTX: { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" },
  PACK: { contentType: "application/zip", extension: "zip" },
};

/** An uploaded image or logo. */
export interface InfographicAssetRecord {
  id: string;
  tenantId: string;
  kind: "IMAGE" | "LOGO";
  name: string;
  contentType: string;
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  credit?: string;
  createdById: string;
  createdAt: Date;
  archivedAt?: Date;
}

export interface IInfographicAssetRepository {
  create(record: InfographicAssetRecord): Promise<Result<InfographicAssetRecord>>;
  findById(id: string, tenantId: TenantId): Promise<Result<InfographicAssetRecord | null>>;
  findByIds(ids: readonly string[], tenantId: TenantId): Promise<Result<InfographicAssetRecord[]>>;
  list(tenantId: TenantId): Promise<Result<InfographicAssetRecord[]>>;
  archive(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
}

/** Re-encodes an uploaded picture: bounded size, a safe type, no embedded metadata. */
export interface IImageNormalizer {
  normalize(bytes: Buffer, opts?: { maxEdge?: number }): Promise<Result<{ bytes: Buffer; contentType: "image/png" | "image/jpeg"; width: number; height: number }>>;
}

export interface IBrandKitRepository {
  get(tenantId: TenantId): Promise<Result<OrganizationBrandKit | null>>;
  save(tenantId: TenantId, kit: OrganizationBrandKit, userId: string, id: string): Promise<Result<void>>;
}

export interface InfographicUserTemplateRecord {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  baseTemplateId: string;
  configJson: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInfographicUserTemplateRepository {
  create(record: InfographicUserTemplateRecord): Promise<Result<InfographicUserTemplateRecord>>;
  findById(id: string, tenantId: TenantId): Promise<Result<InfographicUserTemplateRecord | null>>;
  list(tenantId: TenantId): Promise<Result<InfographicUserTemplateRecord[]>>;
  remove(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface InfographicShareLinkRecord {
  id: string;
  tenantId: string;
  infographicId: string;
  exportId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  viewCount: number;
  createdById: string;
  createdAt: Date;
}

export interface IInfographicShareRepository {
  create(record: InfographicShareLinkRecord): Promise<Result<InfographicShareLinkRecord>>;
  listByInfographic(infographicId: string, tenantId: TenantId): Promise<Result<InfographicShareLinkRecord[]>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
  /** By token hash across organizations (the visitor has no session); run on the admin connection. */
  findByTokenHash(tokenHash: string): Promise<Result<InfographicShareLinkRecord | null>>;
  recordView(id: string): Promise<Result<void>>;
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
  /** Every published file of a project, newest first (the report editor picks a picture from these). */
  findExportsByProject(projectId: string, tenantId: TenantId): Promise<Result<InfographicExportRecord[]>>;
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
  /** Outlines the browser resolved from the bundled boundaries (optional; pins draw without them). */
  mapShapesJson?: string;
  /** Uploaded images the design uses, as `{ [assetId]: { dataUri, width, height } }`. */
  assetsJson?: string;
  /** The organization's brand kit, when the design uses it. */
  brandJson?: string;
  /** A portfolio design's data (every project the person can see), instead of one project's records. */
  portfolioJson?: string;
  /** Studio preview: empty authored blocks draw a hint. */
  preview?: boolean;
}

/** One composed page: the SVG and its canvas size in px. */
export interface InfographicPage {
  svg: string;
  width: number;
  height: number;
  /** Where each block sits (canvas px), for click-to-select in the Studio. */
  blocks?: Array<{ index: number; x: number; y: number; width: number; height: number }>;
}

export type InfographicRasterScale = 1 | 2 | 3;

export interface IInfographicRenderer {
  /** Page 1 as a PNG at 1×, 2× or 3× the canvas size. */
  renderPng(input: InfographicRenderInput, scale?: InfographicRasterScale): Promise<Result<Buffer>>;
  /** Every page as a PNG (for a multi-page pack). */
  renderPngPages(input: InfographicRenderInput, scale?: InfographicRasterScale): Promise<Result<Buffer[]>>;
  /** A tagged vector PDF; `altText` is the description each page carries for screen readers. */
  renderPdf(input: InfographicRenderInput, meta?: { altText?: string }): Promise<Result<Buffer>>;
  /** The pages as SVG, for the Studio's live preview and for the SVG download. */
  renderSvgPages(input: InfographicRenderInput): Promise<Result<InfographicPage[]>>;
  /** A PowerPoint file with one slide per page (page images, with alt text and sources in the notes). */
  renderPptx(input: InfographicRenderInput, meta: { title: string; altText: string; sourcesNote: string }): Promise<Result<Buffer>>;
  /** A ZIP: every page as PNG (1× and 2×), the PDF, the SVG pages, the description, a caption and the sources. */
  renderPack(input: InfographicRenderInput, meta: { title: string; altText: string; caption: string; sourcesNote: string }): Promise<Result<Buffer>>;
}

/** The organization's display name and logo for the export header (read-only). */
export interface IOrganizationBrandReader {
  brandFor(tenantId: TenantId): Promise<Result<{ name: string; logoUrl?: string }>>;
}
