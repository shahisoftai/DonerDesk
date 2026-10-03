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

export interface PeriodIndicatorScope {
  /** True when every project indicator is in scope (cadence and custom reports). */
  all: boolean;
  /** In-scope indicator ids when `all` is false. */
  ids: ReadonlySet<string>;
  /** Activity/situation reports: the activities the report covers. */
  activities?: ActivityUpdate[];
}

/**
 * The indicators a period's report speaks about — the same rule generation uses
 * (`scopeIndicatorData`), for the views and checks that count indicator values:
 * the workspace panel, export preflight, readiness and the missing-items scan.
 * Without an activity repository (legacy wiring) everything is in scope.
 */
export async function periodIndicatorScope(
  activities: IActivityUpdateRepository | undefined,
  period: Pick<ReportingPeriod, "id" | "reportType" | "scope" | "projectId" | "duration">,
  tenantId: TenantId,
): Promise<Result<PeriodIndicatorScope>> {
  if (period.reportType !== "ACTIVITY" && period.reportType !== "SITUATION") return { ok: true, value: { all: true, ids: new Set() } };
  if (!activities) return { ok: true, value: { all: true, ids: new Set() } };
  const covered = await resolvePeriodActivities(activities, period, tenantId);
  if (!covered.ok) return covered;
  const ids = period.reportType === "ACTIVITY"
    ? new Set(covered.value.map((a) => a.indicatorId).filter((id): id is string => Boolean(id)))
    : new Set<string>();
  return { ok: true, value: { all: false, ids, activities: covered.value } };
}

export function inIndicatorScope(scope: PeriodIndicatorScope, indicatorId: string): boolean {
  return scope.all || scope.ids.has(indicatorId);
}
