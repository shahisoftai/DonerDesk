import type { Result, TenantId } from "@donordesk/domain";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../ports/reporting.js";
import type { GuardedActivity, IActivityApprovalGuard } from "../ports/activity-approval-guard.js";

const FINAL_DRAFT_STATUSES: ReadonlySet<string> = new Set(["APPROVED", "EXPORTED", "SUBMITTED"]);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A record is "used" by an approved report when the report of its own period is approved (or beyond), or an approved
 * situation report's window contains its date, or an approved final report exists (it draws on every accepted record).
 */
export class ActivityApprovalGuard implements IActivityApprovalGuard {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
  ) {}

  async approvedReportsUsing(tenantId: TenantId, activity: GuardedActivity): Promise<Result<string[]>> {
    const periods = await this.periods.findByProject(activity.projectId, tenantId);
    if (!periods.ok) return periods;
    const day = activity.activityDate.getTime();
    const candidates = periods.value.filter((p) => {
      if (p.id === activity.reportingPeriodId) return true;
      if (p.reportType === "FINAL") return true;
      if (p.reportType === "SITUATION") return p.duration.start.getTime() <= day && day <= p.duration.end.getTime() + DAY_MS - 1;
      return false;
    });
    const used: string[] = [];
    for (const period of candidates) {
      const drafts = await this.drafts.findByReportingPeriod(period.id, tenantId);
      if (!drafts.ok) return drafts;
      if (drafts.value.some((d) => FINAL_DRAFT_STATUSES.has(d.status))) used.push(describePeriod(period));
    }
    return { ok: true, value: used };
  }
}

function describePeriod(period: { reportType: string; duration: { start: Date; end: Date } }): string {
  const type = period.reportType.toLowerCase().replace(/_/g, "-");
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `the ${type} report ${fmt(period.duration.start)} to ${fmt(period.duration.end)}`;
}
