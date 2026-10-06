import type { Result, TenantId } from "@donordesk/domain";
import type { IIndicatorUpdateRepository } from "../ports/logframe.js";
import type { IReportDraftRepository } from "../ports/reporting.js";
import type { IIndicatorApprovalGuard } from "../ports/indicator-approval-guard.js";

const FINAL_DRAFT_STATUSES: ReadonlySet<string> = new Set(["APPROVED", "EXPORTED", "SUBMITTED"]);

/** An indicator is "used" by a report when it has a value in that report's period and the period's report is approved (or beyond). */
export class IndicatorApprovalGuard implements IIndicatorApprovalGuard {
  constructor(
    private readonly updates: IIndicatorUpdateRepository,
    private readonly drafts: IReportDraftRepository,
  ) {}

  async isUsedInApprovedReport(tenantId: TenantId, indicatorId: string): Promise<Result<boolean>> {
    const updates = await this.updates.findByIndicator(indicatorId, tenantId);
    if (!updates.ok) return updates;
    const periodIds = [...new Set(updates.value.map((u) => u.reportingPeriodId))];
    for (const periodId of periodIds) {
      const drafts = await this.drafts.findByReportingPeriod(periodId, tenantId);
      if (!drafts.ok) return drafts;
      if (drafts.value.some((d) => FINAL_DRAFT_STATUSES.has(d.status))) return { ok: true, value: true };
    }
    return { ok: true, value: false };
  }
}
