import type { Result, TenantId } from "@donordesk/domain";
import type { LogframeItem, Indicator, IndicatorUpdate } from "@donordesk/domain";

export interface ILogframeRepository {
  create(item: LogframeItem): Promise<Result<LogframeItem>>;
  update(item: LogframeItem): Promise<Result<LogframeItem>>;
  findById(id: string, tenantId: TenantId): Promise<Result<LogframeItem | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<LogframeItem[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IIndicatorRepository {
  create(i: Indicator): Promise<Result<Indicator>>;
  update(i: Indicator): Promise<Result<Indicator>>;
  findById(id: string, tenantId: TenantId): Promise<Result<Indicator | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<Indicator[]>>;
  findByLogframeItem(logframeItemId: string, tenantId: TenantId): Promise<Result<Indicator[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IIndicatorUpdateRepository {
  create(u: IndicatorUpdate): Promise<Result<IndicatorUpdate>>;
  update(u: IndicatorUpdate): Promise<Result<IndicatorUpdate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<IndicatorUpdate | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[]>>;
  findByIndicator(indicatorId: string, tenantId: TenantId): Promise<Result<IndicatorUpdate[]>>;
}
