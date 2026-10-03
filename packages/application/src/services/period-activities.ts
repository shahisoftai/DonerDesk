import type { Result, TenantId, ActivityUpdate, ReportingPeriod } from "@donordesk/domain";
import type { IActivityUpdateRepository } from "../ports/activities.js";

/**
 * The activity records a reporting period reports on. An ACTIVITY report covers
 * exactly the activities picked in its scope (whatever period they were logged
 * in); every other type covers the activities logged against the period.
 */
export async function resolvePeriodActivities(
  activities: IActivityUpdateRepository,
  period: Pick<ReportingPeriod, "id" | "reportType" | "scope" | "projectId" | "duration">,
  tenantId: TenantId,
): Promise<Result<ActivityUpdate[]>> {
  // A situation report covers the activities dated inside its window, whichever
  // period they were logged against.
  if (period.reportType === "SITUATION" && period.duration) {
    const all = await activities.findByProject(period.projectId, tenantId);
    if (!all.ok) return all;
    const { start, end } = period.duration;
    const endOfDay = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { ok: true, value: all.value.filter((a) => a.activityDate >= start && a.activityDate <= endOfDay).sort((a, b) => a.activityDate.getTime() - b.activityDate.getTime()) };
  }
  const ids = period.reportType === "ACTIVITY" ? period.scope.activityIds ?? [] : [];
  if (ids.length === 0) return activities.findByReportingPeriod(period.id, tenantId);

  const wanted = new Set(ids);
  const all = await activities.findByProject(period.projectId, tenantId);
  if (!all.ok) return all;
  return { ok: true, value: all.value.filter((a) => wanted.has(a.id)).sort((a, b) => a.activityDate.getTime() - b.activityDate.getTime()) };
}
