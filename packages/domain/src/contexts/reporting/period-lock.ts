import type { ReportStatusValue } from "../../value-objects/report-status.js";

/**
 * Once a report is approved, the figures it was approved on must not change under it. The lock used to exist only for
 * CLOSED, which nothing ever set, so approval locked nothing. APPROVED, SUBMITTED and CLOSED all lock a period's indicator
 * values; the way back is to reopen the report (which asks why, returns it to draft and is audited), never a silent edit.
 */
export const LOCKED_PERIOD_STATUSES: readonly ReportStatusValue[] = ["APPROVED", "SUBMITTED", "CLOSED"];

export function isPeriodLocked(status: ReportStatusValue): boolean {
  return LOCKED_PERIOD_STATUSES.includes(status);
}

/** The sentence shown when someone tries to change a locked period's figures. */
export function periodLockedMessage(status: ReportStatusValue): string {
  if (status === "CLOSED") return "Indicator data cannot be edited once a reporting period is closed";
  const state = status === "SUBMITTED" ? "submitted" : "approved";
  return `This report is ${state}, so its figures are locked. Reopen the report (you will be asked why, and it is recorded) to correct them.`;
}
