import type { Result, TenantId, ActivityUpdate, ReportingPeriod } from "@donordesk/domain";
import type { IActivityUpdateRepository } from "../ports/activities.js";

/**
 * The activity records a reporting period reports on. An ACTIVITY report covers
 * exactly the activities picked in its scope (whatever period they were logged
 * in); every other type covers the activities logged against the period.
 */
export async function resolvePeriodActivities(
  activities: IActivityUpdateRepository,
  period: Pick<ReportingPeriod, "id" | "reportType" | "scope" | "projectId">,
  tenantId: TenantId,
): Promise<Result<ActivityUpdate[]>> {
  const ids = period.reportType === "ACTIVITY" ? period.scope.activityIds ?? [] : [];
  if (ids.length === 0) return activities.findByReportingPeriod(period.id, tenantId);

  const wanted = new Set(ids);
  const all = await activities.findByProject(period.projectId, tenantId);
  if (!all.ok) return all;
  return { ok: true, value: all.value.filter((a) => wanted.has(a.id)).sort((a, b) => a.activityDate.getTime() - b.activityDate.getTime()) };
}
