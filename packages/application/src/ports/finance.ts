import type { DomainError, PeriodFinancialSummary, Result, TenantId } from "@donordesk/domain";

export interface IPeriodFinancialRepository {
  findByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<PeriodFinancialSummary | null, DomainError>>;
  /** Inserts the summary or replaces the stored one for the same period. */
  save(summary: PeriodFinancialSummary): Promise<Result<PeriodFinancialSummary, DomainError>>;
}
