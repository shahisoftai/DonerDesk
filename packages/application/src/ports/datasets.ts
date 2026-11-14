import type { CheckConfig, ColumnDef, DatasetFigure, DatasetRowValues, DatasetScope, Finding, Restriction, Result, SharePolicy, TenantId, TidyStep, VersionStatus, Workbook } from "@donordesk/domain";

/**
 * Phase 54 datasets: narrow ports (§1.5 I). `IDatasetCatalog` holds definitions and versions, `IDatasetRowStore` the rows of a version,
 * `IWorkbookReader` turns an uploaded file into sheets of cells. Raw files go through the existing `IStorage`.
 */
export interface StoredDataset {
  id: string;
  tenantId: TenantId;
  scope: DatasetScope;
  projectId?: string | undefined;
  name: string;
  description: string;
  kitKey?: string | undefined;
  /** Role → source header, so the next upload maps itself. */
  kitMapping: Record<string, string>;
  currentVersionId?: string | undefined;
  sharePolicy: SharePolicy;
  restricted: boolean;
  restriction?: Restriction | undefined;
  /** A connector filling this dataset (DHIS2), without its key. */
  connector?: { kind: string; config: Record<string, unknown>; lastPullAt?: string | undefined; lastPullJson?: string | undefined } | undefined;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredDatasetVersion {
  id: string;
  tenantId: TenantId;
  datasetId: string;
  number: number;
  columns: ColumnDef[];
  steps: TidyStep[];
  figures: DatasetFigure[];
  checks: CheckConfig[];
  rowCount: number;
  fileKey?: string | undefined;
  fileName?: string | undefined;
  fileHash?: string | undefined;
  findings: Finding[];
  /** What this version changed against the one before ("+106 rows for 2022-08, 3 rows changed, 0 removed"). */
  summary: string;
  status: VersionStatus;
  decidedById?: string | undefined;
  decisionNote?: string | undefined;
  createdById: string;
  createdAt: Date;
}

export interface IDatasetCatalog {
  create(d: StoredDataset): Promise<Result<void>>;
  /** Writes every mutable field; with `expectedUpdatedAt` only if nobody saved in between. */
  update(d: StoredDataset, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDataset | null>>;
  /** Organisation datasets and the datasets of the named projects. */
  list(tenantId: TenantId, projectIds: readonly string[]): Promise<Result<StoredDataset[]>>;
  /** Datasets with a scheduled connector, across organisations (the scheduled pull, on the admin connection). */
  listWithConnector(): Promise<Result<StoredDataset[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  createVersion(v: StoredDatasetVersion): Promise<Result<void>>;
  findVersion(id: string, tenantId: TenantId): Promise<Result<StoredDatasetVersion | null>>;
  /** Newest first. */
  listVersions(datasetId: string, tenantId: TenantId): Promise<Result<StoredDatasetVersion[]>>;
  decideVersion(id: string, tenantId: TenantId, status: VersionStatus, decidedById: string, note?: string): Promise<Result<void>>;
  deleteVersion(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IDatasetRowStore {
  /** Writes a version's rows in chunks; a version's rows are written once and never changed. */
  write(tenantId: TenantId, versionId: string, rows: readonly DatasetRowValues[]): Promise<Result<void>>;
  read(tenantId: TenantId, versionId: string): Promise<Result<DatasetRowValues[]>>;
  remove(tenantId: TenantId, versionId: string): Promise<Result<void>>;
}

/** Sheets of cells from an uploaded file (xlsx or csv), the type told from the bytes; formula cells are read as their values. */
export interface IWorkbookReader {
  read(bytes: Buffer, fileName: string): Promise<Result<Workbook & { format: "XLSX" | "CSV" }>>;
}

/** A dataset figure used for an indicator (§3.9). */
export interface StoredDatasetLink {
  id: string;
  tenantId: TenantId;
  datasetId: string;
  indicatorId: string;
  figureRef: string;
  filters: Array<{ column: string; values: string[] }>;
  byPlace: boolean;
  /** Notes from the last write: values a reviewer had verified that the dataset now says differently. */
  lastSync?: { at: string; written: number; notes: string[] } | undefined;
  createdById: string;
  createdAt: Date;
}

export interface IDatasetLinkRepository {
  create(l: StoredDatasetLink): Promise<Result<void>>;
  listForDataset(datasetId: string, tenantId: TenantId): Promise<Result<StoredDatasetLink[]>>;
  listForIndicator(indicatorId: string, tenantId: TenantId): Promise<Result<StoredDatasetLink[]>>;
  setLastSync(id: string, tenantId: TenantId, sync: NonNullable<StoredDatasetLink["lastSync"]>): Promise<Result<void>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

/** The encrypted key of a dataset's connector (never returned to a screen). */
export interface IDatasetSecretStore {
  available(): boolean;
  seal(plain: string): string;
  open(sealed: string): string | undefined;
  read(datasetId: string, tenantId: TenantId): Promise<Result<string | null>>;
  write(datasetId: string, tenantId: TenantId, sealed: string | null): Promise<Result<void>>;
}

/** One https GET with the connector safety rules (public addresses only, no redirects, size and time limits). */
export interface IConnectorFetch { getJson(url: string, headers: Record<string, string>): Promise<Result<unknown>> }
