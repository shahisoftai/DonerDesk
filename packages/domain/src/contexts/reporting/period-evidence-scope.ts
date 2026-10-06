import { ROLL_UP_REPORT_TYPES } from "./period-type-rules.js";

/**
 * Which evidence a report covers, in one place. A cadence report covers the files tagged to its own
 * period and the files of its activities; a roll-up report (semi-annual / annual / final) states
 * progress since the project started, so it covers the project's evidence. Generation, readiness,
 * the report-inputs panel and the export wizard all ask this function, so their counts cannot differ.
 */
export type PeriodEvidenceMode = "PERIOD" | "PROJECT";

export function periodEvidenceMode(reportType: string): PeriodEvidenceMode {
  return ROLL_UP_REPORT_TYPES.has(reportType) ? "PROJECT" : "PERIOD";
}

/** Whether a file belongs to a report, given the mode, the period and the report's activity ids. */
export function isEvidenceInPeriodScope(
  file: { reportingPeriodId?: string; activityId?: string },
  scope: { mode: PeriodEvidenceMode; periodId: string; activityIds: ReadonlySet<string> },
): boolean {
  if (scope.mode === "PROJECT") return true;
  if (file.reportingPeriodId === scope.periodId) return true;
  return file.activityId !== undefined && scope.activityIds.has(file.activityId);
}

/** The period a file is tagged to: the one given explicitly wins, otherwise the one of the activity it documents. */
export function resolveEvidencePeriod(explicit: string | undefined, fromActivity: string | undefined): { periodId?: string; source: "explicit" | "activity" | "none" } {
  if (explicit) return { periodId: explicit, source: "explicit" };
  if (fromActivity) return { periodId: fromActivity, source: "activity" };
  return { source: "none" };
}
