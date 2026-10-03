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

/**
 * Which indicator data a report of this type may speak about. A cadence report
 * covers the whole results framework. An activity report only the indicators
 * its own activities feed. A situation report none: its window is too short for
 * indicator results, and the empty findings read as "zero, down from last period".
 */
export function scopeIndicatorData<F extends { indicatorId: string }, U extends { indicatorId: string }>(
  reportType: string,
  activities: ReadonlyArray<{ indicatorId?: string }>,
  findings: F[],
  updates: U[],
): { findings: F[]; updates: U[] } {
  if (reportType === "SITUATION") return { findings: [], updates: [] };
  if (reportType === "ACTIVITY") {
    const ids = new Set(activities.map((a) => a.indicatorId).filter((id): id is string => Boolean(id)));
    return { findings: findings.filter((f) => ids.has(f.indicatorId)), updates: updates.filter((u) => ids.has(u.indicatorId)) };
  }
  return { findings, updates };
}
