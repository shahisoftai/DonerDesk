import { CADENCE_REPORT_TYPES } from "./report-scope.js";
import type { PeriodFact } from "./period-type-rules.js";

/**
 * When a reporting period may be cancelled, restored or converted to the final report. One place, used by the
 * handlers (which refuse) and by the screen (which explains), so a button never offers what the server will refuse.
 */

/** A report in one of these states has been approved, exported or sent: its period can no longer be changed. */
export const RELEASED_DRAFT_STATUSES: ReadonlySet<string> = new Set(["APPROVED", "EXPORTED", "SUBMITTED"]);

export type LifecycleCheck = { ok: true } | { ok: false; reason: string };

const refuse = (reason: string): LifecycleCheck => ({ ok: false, reason });

export function hasReleasedReport(draftStatuses: ReadonlyArray<string>): boolean {
  return draftStatuses.some((s) => RELEASED_DRAFT_STATUSES.has(s));
}

/** A period with an approved or sent report is part of the record: it cannot be cancelled. Its data stays when it is. */
export function checkCancelPeriod(input: { cancelled: boolean; draftStatuses: ReadonlyArray<string> }): LifecycleCheck {
  if (input.cancelled) return refuse("This period is already cancelled.");
  if (hasReleasedReport(input.draftStatuses)) {
    return refuse("This period has an approved report, so it cannot be cancelled. Reopen the report first if it was approved by mistake.");
  }
  return { ok: true };
}

export function checkRestorePeriod(input: { cancelled: boolean; overlapping?: PeriodFact }): LifecycleCheck {
  if (!input.cancelled) return refuse("This period is not cancelled.");
  if (input.overlapping) {
    return refuse("Another period now covers these dates, so this one cannot be restored. Cancel or move that period first.");
  }
  return { ok: true };
}

/**
 * A monthly (or other regular) period can become the Final report when it is the last block of the cadence, no final
 * report exists yet, and no report on it has been approved or sent. This is the repair for a final month that was
 * created as a regular month.
 */
export function checkConvertToFinal(input: {
  period: PeriodFact;
  cancelled: boolean;
  /** The project's other periods that are not cancelled (this one excluded). */
  others: ReadonlyArray<PeriodFact>;
  draftStatuses: ReadonlyArray<string>;
}): LifecycleCheck {
  const { period, others } = input;
  if (input.cancelled) return refuse("A cancelled period cannot be converted. Restore it first.");
  if (period.reportType === "FINAL") return refuse("This period is already the final report.");
  if (!CADENCE_REPORT_TYPES.has(period.reportType)) {
    return refuse("Only a regular period (monthly, quarterly, semi-annual or annual) can become the final report.");
  }
  if (others.some((p) => p.reportType === "FINAL")) {
    return refuse("The project already has a final report. A project has one.");
  }
  const later = others.find((p) => CADENCE_REPORT_TYPES.has(p.reportType) && p.start.getTime() > period.start.getTime());
  if (later) {
    return refuse("A later period exists, so this is not the last block of the project. Only the closing period can become the final report.");
  }
  if (hasReleasedReport(input.draftStatuses)) {
    return refuse("This period has an approved report, so it cannot be converted. Reopen the report first if it was approved by mistake.");
  }
  return { ok: true };
}
