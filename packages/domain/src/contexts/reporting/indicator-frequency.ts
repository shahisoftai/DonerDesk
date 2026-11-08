/**
 * When an indicator is *due*. `Indicator.frequency` is free text ("quarterly", "Every 6 months", "annual survey"), so it
 * is read conservatively: anything not recognised means "every period", never "never". A value recorded for a period is
 * always expected there, whatever the frequency says.
 */

/**
 * The collection frequencies an indicator can be given, in one table (the project wizard's list, the sector library's check and the
 * due-date rule all read it). A PERIODIC frequency is a cadence; an EVENT one is measured when the work or the survey happens, so it is
 * never "due" in an ordinary month: it is expected where a value is recorded and in the project's closing period.
 */
export type FrequencyKind = "PERIODIC" | "EVENT";
export interface FrequencyChoice { value: string; kind: FrequencyKind }
export const FREQUENCY_CHOICES: readonly FrequencyChoice[] = [
  { value: "Weekly", kind: "PERIODIC" }, { value: "Monthly", kind: "PERIODIC" }, { value: "Quarterly", kind: "PERIODIC" }, { value: "Semi-annual", kind: "PERIODIC" }, { value: "Annual", kind: "PERIODIC" },
  { value: "Per survey", kind: "EVENT" }, { value: "Per assessment", kind: "EVENT" }, { value: "Per analysis", kind: "EVENT" }, { value: "Per campaign", kind: "EVENT" },
  { value: "Per distribution", kind: "EVENT" }, { value: "Per season", kind: "EVENT" }, { value: "At construction", kind: "EVENT" },
];

/** Whether free text names an event ("Per survey", "per round", "at construction") rather than a cadence. Unrecognised text is a cadence of every period, as before. */
export function frequencyKind(frequency: string | null | undefined): FrequencyKind {
  const text = (frequency ?? "").trim().toLowerCase();
  if (FREQUENCY_CHOICES.some((c) => c.kind === "EVENT" && c.value.toLowerCase() === text)) return "EVENT";
  return /^per\s+[a-z]+|^at (construction|handover|completion)\b|^when (it|the work) happens/.test(text) ? "EVENT" : "PERIODIC";
}

/** Months between measurements, or 1 when the text names no cadence we recognise. */
export function frequencyIntervalMonths(frequency: string | null | undefined): number {
  const text = (frequency ?? "").trim().toLowerCase();
  if (!text) return 1;
  const every = /\bevery\s+(\d{1,2})\s+months?\b/.exec(text);
  if (every) return Math.max(1, Number(every[1]));
  if (/\b(semi[- ]?annual(ly)?|bi[- ]?annual(ly)?|half[- ]?year(ly)?|twice (a|per) year|6[- ]month)/.test(text)) return 6;
  if (/\bquarter(ly)?\b|\b(3|three)[- ]month/.test(text)) return 3;
  if (/\b(annual(ly)?|yearly|once (a|per) year|12[- ]month|baseline|endline|end[- ]of[- ]project)\b/.test(text)) return 12;
  return 1;
}

export interface FrequencyWindow {
  /** First day of the project (cadence counts from here). */
  projectStart: Date;
  periodEnd: Date;
}

/** Whole months from the project start to the end of the period (a 30-day month rounds up), at least 1. */
function monthsElapsed(window: FrequencyWindow): number {
  const start = window.projectStart;
  const end = window.periodEnd;
  const whole = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  // A period ending on the last days of its month counts that month in full.
  const endsMonth = end.getUTCDate() >= 28 || end.getUTCDate() >= start.getUTCDate() - 1;
  return Math.max(1, endsMonth ? whole + 1 : whole);
}

/**
 * True when the indicator should have a value in the period that ends at `periodEnd`: the period closes an interval
 * counted from the project start. The closing period of the project is always due (`isFinalPeriod`).
 */
export function isDueInPeriod(frequency: string | null | undefined, window: FrequencyWindow, options: { isFinalPeriod?: boolean } = {}): boolean {
  if (options.isFinalPeriod) return true;
  if (frequencyKind(frequency) === "EVENT") return false;
  const interval = frequencyIntervalMonths(frequency);
  if (interval === 1) return true;
  return monthsElapsed(window) % interval === 0;
}

/**
 * Whether a period page should ask for the indicator: due by frequency, or already holding a value. An indicator that
 * is not due and has no value is "not due this month", never "needs attention".
 */
export function expectedInPeriod(input: { frequency: string | null | undefined; window: FrequencyWindow; hasValue: boolean; isFinalPeriod?: boolean }): boolean {
  return input.hasValue || isDueInPeriod(input.frequency, input.window, { isFinalPeriod: input.isFinalPeriod });
}
