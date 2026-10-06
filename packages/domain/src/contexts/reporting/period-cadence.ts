/**
 * Reporting period date suggestions: given a report type/frequency and the
 * project's own start/end dates, works out where the *next* reporting period
 * should sit — chained after the latest existing period, clipped to the
 * project's end — instead of leaving every date to be typed by hand (which
 * is how a monthly period's donor deadline used to end up equal to the
 * project's own end date: nothing computed it, so whatever the user typed
 * for "end date" is what showed up everywhere as "deadline").
 *
 * Pure date arithmetic in UTC, shared by the "new reporting period" form
 * (`apps/web`) and `EnsureAutoPeriodHandler` (server-side auto-creation), so
 * both agree on exactly the same cadence.
 */

/** Calendar-month block length per cadence; report types/frequencies with no entry have no fixed cadence (left for the user to set manually). */
const CADENCE_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

export interface SuggestedPeriodDates {
  /** ISO date-only, "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(d: Date, days: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + days);
  return c;
}

function addUtcMonths(d: Date, months: number): Date {
  const c = new Date(d.getTime());
  c.setUTCMonth(c.getUTCMonth() + months);
  return c;
}

function latest(dates: ReadonlyArray<string | Date>): Date | null {
  return dates.reduce<Date | null>((max, raw) => {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return max;
    return !max || d.getTime() > max.getTime() ? d : max;
  }, null);
}

/**
 * Suggests the next reporting period's start/end dates. `reportType` accepts
 * both a `ReportingPeriod.reportType` ("MONTHLY"/"QUARTERLY"/"ANNUAL"/"FINAL"/
 * "ACTIVITY"/"SITUATION"/"CUSTOM") and a `Project.reportingFrequency"`
 * ("SEMI_ANNUAL" additionally) — only the cadence lookup differs, so one
 * function serves both callers.
 *
 * Returns null when:
 * - the type has no fixed cadence (ACTIVITY/SITUATION/CUSTOM) — left manual;
 * - or the project's duration is already fully covered by existing periods.
 *
 * FINAL always runs from the next period's start straight through the
 * project's own end date — the one case where "= project end" is correct.
 */
export function suggestPeriodDates(
  reportType: string,
  projectStart: string | Date,
  projectEnd: string | Date,
  existingPeriodEnds: ReadonlyArray<string | Date> = [],
): SuggestedPeriodDates | null {
  const start = projectStart instanceof Date ? projectStart : new Date(projectStart);
  const end = projectEnd instanceof Date ? projectEnd : new Date(projectEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const lastEnd = latest(existingPeriodEnds);
  const periodStart = lastEnd ? addUtcDays(lastEnd, 1) : start;
  if (periodStart.getTime() > end.getTime()) return null;

  if (reportType === "FINAL") {
    return { startDate: toDateOnly(periodStart), endDate: toDateOnly(end) };
  }
  const months = CADENCE_MONTHS[reportType];
  if (!months) return null;

  const rawEnd = addUtcDays(addUtcMonths(periodStart, months), -1);
  const periodEnd = rawEnd.getTime() > end.getTime() ? end : rawEnd;
  return { startDate: toDateOnly(periodStart), endDate: toDateOnly(periodEnd) };
}

/** Used only when neither the donor template nor the reporting profile states a deadline offset. */
export const DEFAULT_DEADLINE_OFFSET_DAYS = 30;

/** Suggests a donor deadline: the period's end date plus an offset (days). */
export function suggestDeadline(periodEnd: string | Date, offsetDays: number): string {
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  return toDateOnly(addUtcDays(end, offsetDays));
}

/**
 * Default days between a period's end and its donor deadline for ad-hoc types:
 * a situation update is due in days and an activity report within a week, not
 * the 30 days a cadence report gets. Undefined for every other type.
 */
export function defaultDeadlineOffsetForType(reportType: string): number | undefined {
  if (reportType === "SITUATION") return 3;
  if (reportType === "ACTIVITY") return 7;
  return undefined;
}

export interface PlannedPeriod {
  startDate: string;
  endDate: string;
}

export interface CadencePlan {
  /** The periods to create now, in order. */
  periods: PlannedPeriod[];
  /** The last block of the project: it is the closing (final) report's period, created through the closing-report steps. */
  closing: PlannedPeriod | null;
}

/**
 * Every period a project's cadence still needs, from its own dates (the one date arithmetic the new-period form and
 * auto-creation already use). The last block, the one that reaches the project's end, belongs to the closing report,
 * so it is shown but not created here. Types with no fixed cadence plan nothing.
 */
export function planCadencePeriods(
  reportType: string,
  projectStart: string | Date,
  projectEnd: string | Date,
  existingPeriodEnds: ReadonlyArray<string | Date> = [],
): CadencePlan {
  const end = projectEnd instanceof Date ? projectEnd : new Date(projectEnd);
  const blocks: PlannedPeriod[] = [];
  const ends: Array<string | Date> = [...existingPeriodEnds];
  for (let guard = 0; guard < 120; guard += 1) {
    const next = suggestPeriodDates(reportType, projectStart, projectEnd, ends);
    if (!next) break;
    blocks.push(next);
    ends.push(next.endDate);
  }
  const reachesEnd = (p: PlannedPeriod) => !Number.isNaN(end.getTime()) && new Date(p.endDate).getTime() === end.getTime();
  const last = blocks[blocks.length - 1];
  if (last && reachesEnd(last)) return { periods: blocks.slice(0, -1), closing: last };
  return { periods: blocks, closing: null };
}
