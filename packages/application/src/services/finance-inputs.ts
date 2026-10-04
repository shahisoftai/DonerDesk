import type { DomainError, FinanceDataMode, FinanceSummaryView, ReportingPeriod, Result, TenantId } from "@donordesk/domain";
import { financeAppliesTo } from "@donordesk/domain";
import type { IPeriodFinancialRepository } from "../ports/finance.js";
import type { IReportingProfileRepository } from "../ports/setup.js";

/** Where a period stands with its financial figures. */
export type FinanceStatus = "OFF" | "MISSING" | "UNVERIFIED" | "VERIFIED";

/** What a report generation may know about a period's finances. */
export interface IFinanceInputs {
  /** OFF when finance is switched off or does not apply to this kind of report. */
  statusFor(period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">, tenantId: TenantId): Promise<Result<FinanceStatus, DomainError>>;
  /** The project's finance data mode (DISABLED when it has no reporting profile). */
  modeFor(projectId: string, tenantId: TenantId): Promise<Result<FinanceDataMode, DomainError>>;
  /**
   * The verified figures for the period, or undefined when finance is switched
   * off, does not apply to this kind of report, or nothing verified exists.
   * Unverified figures are never returned.
   */
  verifiedFor(period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">, tenantId: TenantId): Promise<Result<FinanceSummaryView | undefined, DomainError>>;
  /**
   * The verified figures stored for a period (when finance is switched on), for
   * checking numbers already written in a report. A summary can only be stored
   * for a report type that has a financial section, so no type check is needed.
   */
  verifiedForPeriod(periodId: string, projectId: string, tenantId: TenantId): Promise<Result<FinanceSummaryView | undefined, DomainError>>;
}

export class FinanceInputsService implements IFinanceInputs {
  constructor(
    private readonly profiles: IReportingProfileRepository,
    private readonly summaries: IPeriodFinancialRepository,
  ) {}

  async modeFor(projectId: string, tenantId: TenantId): Promise<Result<FinanceDataMode, DomainError>> {
    const profile = await this.profiles.findByProject(projectId, tenantId);
    if (!profile.ok) return profile;
    return { ok: true, value: profile.value?.financeDataMode ?? "DISABLED" };
  }

  async statusFor(period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">, tenantId: TenantId): Promise<Result<FinanceStatus, DomainError>> {
    const mode = await this.modeFor(period.projectId, tenantId);
    if (!mode.ok) return mode;
    if (!financeAppliesTo(mode.value, period.reportType)) return { ok: true, value: "OFF" };
    const summary = await this.summaries.findByPeriod(period.id, tenantId);
    if (!summary.ok) return summary;
    return { ok: true, value: !summary.value ? "MISSING" : summary.value.isVerified ? "VERIFIED" : "UNVERIFIED" };
  }

  async verifiedFor(period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">, tenantId: TenantId): Promise<Result<FinanceSummaryView | undefined, DomainError>> {
    const mode = await this.modeFor(period.projectId, tenantId);
    if (!mode.ok) return mode;
    if (!financeAppliesTo(mode.value, period.reportType)) return { ok: true, value: undefined };
    return this.verifiedSummary(period.id, tenantId);
  }

  async verifiedForPeriod(periodId: string, projectId: string, tenantId: TenantId): Promise<Result<FinanceSummaryView | undefined, DomainError>> {
    const mode = await this.modeFor(projectId, tenantId);
    if (!mode.ok) return mode;
    if (mode.value === "DISABLED") return { ok: true, value: undefined };
    return this.verifiedSummary(periodId, tenantId);
  }

  private async verifiedSummary(periodId: string, tenantId: TenantId): Promise<Result<FinanceSummaryView | undefined, DomainError>> {
    const summary = await this.summaries.findByPeriod(periodId, tenantId);
    if (!summary.ok) return summary;
    return { ok: true, value: summary.value?.isVerified ? summary.value.view() : undefined };
  }
}
