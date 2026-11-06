import type {
  BlockModel, Canvas, CanvasMode, CanvasScope, CanvasTheme, DatasetBudgetLine, DatasetDay, DatasetPlace, DatasetPlanRow, DomainError,
  ExportFormatId, MetricFinanceFigures, ProjectListSource, Result, TenantId,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IDatasetExtras } from "../services/dataset-extras.js";

/** Where a canvas was converted from. A source converts once: the pair is unique, so converting again returns the same canvas. */
export type CanvasSourceKind = "DASHBOARD" | "INFOGRAPHIC";

/** A canvas as stored: the document plus who owns it and when it changed. The document holds composition and words, never data. */
export interface StoredCanvas {
  id: string;
  tenantId: TenantId;
  scope: CanvasScope;
  mode: CanvasMode;
  projectId?: string;
  ownerId: string;
  title: string;
  canvas: Canvas;
  sourceKind?: CanvasSourceKind;
  sourceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICanvasRepository {
  /** False = the source was converted at the same moment by someone else (the caller reads that one). */
  create(c: StoredCanvas): Promise<Result<boolean>>;
  /** Replaces the document only if the stored revision is still `expectedRevision` (and bumps it); false = someone saved since (a second tab). Writes every mutable field (`?? null`). */
  update(c: StoredCanvas, expectedRevision: number): Promise<Result<boolean>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvas | null>>;
  findBySource(tenantId: TenantId, kind: CanvasSourceKind, sourceId: string): Promise<Result<StoredCanvas | null>>;
  /** Shared canvases (organisation and portfolio, and the project's when given) plus the person's own. */
  listVisible(tenantId: TenantId, ownerId: string, projectId?: string): Promise<Result<StoredCanvas[]>>;
}

/** A published file. Immutable: there is no update; publishing again makes a new export. */
export interface StoredCanvasExport {
  id: string;
  tenantId: TenantId;
  canvasId: string;
  format: ExportFormatId;
  storageKey: string;
  /** The exact inputs it was drawn from, as JSON. */
  snapshotJson: string;
  /** Who made it, when, from which data, as JSON (the footer's facts). */
  provenanceJson: string;
  createdById: string;
  createdAt: Date;
}

export interface ICanvasExportRepository {
  create(e: StoredCanvasExport): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvasExport | null>>;
  listByCanvas(canvasId: string, tenantId: TenantId): Promise<Result<StoredCanvasExport[]>>;
}

/** LIVE reads current data under the link's guest rules; FROZEN serves one immutable export. Only the token's hash is kept. */
export type ShareLinkKind = "LIVE" | "FROZEN";
export interface StoredCanvasShareLink {
  id: string;
  tenantId: TenantId;
  canvasId: string;
  kind: ShareLinkKind;
  exportId?: string;
  label: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdById: string;
  createdAt: Date;
}

export interface ICanvasShareLinkRepository {
  create(l: StoredCanvasShareLink): Promise<Result<void>>;
  listByCanvas(canvasId: string, tenantId: TenantId): Promise<Result<StoredCanvasShareLink[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvasShareLink | null>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
}

/** What an export adapter is given: the canvas, every block already resolved, and the theme. It never reads data itself. */
export interface ResolvedCanvas {
  canvas: Canvas;
  theme: CanvasTheme;
  /** blockId -> the model every renderer paints. */
  models: ReadonlyMap<string, BlockModel<unknown>>;
}

export interface ExportedFile { bytes: Uint8Array; filename: string; mime: string }

/** One adapter per format (`EXPORT_FORMATS`). A block with no form in the format is written as the sentence `exportPlan` gives, never dropped. */
export interface IExportFormat {
  readonly id: ExportFormatId;
  render(input: ResolvedCanvas): Promise<Result<ExportedFile, DomainError>>;
}

/** Proposals only; the caller grounds the text and a person accepts it (see `groundText`). */
export interface ICanvasAiAssist {
  propose(ctx: AuthenticatedContext, input: { kind: string; instruction?: string; facts: ReadonlyArray<string> }): Promise<Result<string, DomainError>>;
}

// ---- narrow readers: a block's resolver needs one kind of extra data, not the whole `IDatasetExtras` ----

export interface IPlanData {
  plan(ctx: AuthenticatedContext, projectId: string): Promise<DatasetPlanRow[] | undefined>;
  activityDays(ctx: AuthenticatedContext, projectId: string): Promise<DatasetDay[] | undefined>;
}
export interface IFinanceData {
  budget(ctx: AuthenticatedContext, projectId: string): Promise<DatasetBudgetLine[] | undefined>;
  finance(ctx: AuthenticatedContext, projectId: string): Promise<MetricFinanceFigures | undefined>;
}
export interface IPlaceData {
  places(ctx: AuthenticatedContext, projectId: string, indicatorId: string, level: number): Promise<DatasetPlace[] | undefined>;
}
export interface IProjectDirectory {
  visibleProjects(ctx: AuthenticatedContext): Promise<ProjectListSource[] | undefined>;
  bookmarkedProjectIds(ctx: AuthenticatedContext): Promise<Set<string>>;
}

/** The wide service must keep satisfying the narrow ones, so wiring never needs an adapter. A change that breaks this fails the build. */
type Covers = IDatasetExtras extends IPlanData & IFinanceData & IPlaceData & IProjectDirectory ? true : never;
export const DATASET_EXTRAS_COVERS_NARROW_PORTS: Covers = true;
