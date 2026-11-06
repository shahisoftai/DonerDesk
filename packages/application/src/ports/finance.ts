import type { DomainError, PeriodFinancialSummary, Result, TenantId } from "@donordesk/domain";

export interface IPeriodFinancialRepository {
  findByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<PeriodFinancialSummary | null, DomainError>>;
  /** Batched form of findByPeriod for callers that need several periods at once (e.g. the Data Center sheet). */
  findByPeriods(reportingPeriodIds: string[], tenantId: TenantId): Promise<Result<PeriodFinancialSummary[], DomainError>>;
  /** Inserts the summary or replaces the stored one for the same period. */
  save(summary: PeriodFinancialSummary): Promise<Result<PeriodFinancialSummary, DomainError>>;
}
