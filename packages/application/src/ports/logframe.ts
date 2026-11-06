import type { Result, TenantId } from "@donordesk/domain";
import type { LogframeItem, Indicator, IndicatorUpdate } from "@donordesk/domain";

export interface ILogframeRepository {
  create(item: LogframeItem): Promise<Result<LogframeItem>>;
  update(item: LogframeItem): Promise<Result<LogframeItem>>;
  /** Atomically persists parentId + sortOrder of the given items. */
  savePositions(items: LogframeItem[]): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<LogframeItem | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<LogframeItem[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IIndicatorRepository {
  create(i: Indicator): Promise<Result<Indicator>>;
  update(i: Indicator): Promise<Result<Indicator>>;
  findById(id: string, tenantId: TenantId): Promise<Result<Indicator | null>>;
  /** Archived indicators are left out unless asked for: reports, grids and readiness never see a retired indicator. */
  findByProject(projectId: string, tenantId: TenantId, options?: { includeArchived?: boolean }): Promise<Result<Indicator[]>>;
  findByLogframeItem(logframeItemId: string, tenantId: TenantId): Promise<Result<Indicator[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IIndicatorUpdateRepository {
  create(u: IndicatorUpdate): Promise<Result<IndicatorUpdate>>;
  update(u: IndicatorUpdate): Promise<Result<IndicatorUpdate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<IndicatorUpdate | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[]>>;
  findByIndicator(indicatorId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[]>>;
  /** The values recorded in any of the given periods, in one query (for "last period's value" suggestions). */
  findByReportingPeriods(reportingPeriodIds: readonly string[], tenantId: TenantId): Promise<Result<IndicatorUpdate[]>>;
  findByIndicatorAndPeriod(indicatorId: string, reportingPeriodId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate | null>>;
}

/** One saved version of a project's results framework (see `LogframeVersioner`). */
export interface LogframeVersionRecord {
  id: string;
  tenantId: string;
  projectId: string;
  version: number;
  snapshotJson: string;
  contentHash: string;
  summary: string;
  createdById: string;
  createdAt: Date;
  approvedById?: string | null;
  approvedAt?: Date | null;
}

export interface ILogframeVersionRepository {
  create(record: LogframeVersionRecord): Promise<Result<LogframeVersionRecord>>;
  latest(projectId: string, tenantId: TenantId): Promise<Result<LogframeVersionRecord | null>>;
  /** Newest first. */
  list(projectId: string, tenantId: TenantId): Promise<Result<LogframeVersionRecord[]>>;
  findByNumber(projectId: string, version: number, tenantId: TenantId): Promise<Result<LogframeVersionRecord | null>>;
  approve(id: string, userId: string, at: Date): Promise<Result<void>>;
}
