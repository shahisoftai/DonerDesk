/**
 * When an indicator is *due*. `Indicator.frequency` is free text ("quarterly", "Every 6 months", "annual survey"), so it
 * is read conservatively: anything not recognised means "every period", never "never". A value recorded for a period is
 * always expected there, whatever the frequency says.
 */

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
  const interval = frequencyIntervalMonths(frequency);
  if (interval === 1 || options.isFinalPeriod) return true;
  return monthsElapsed(window) % interval === 0;
}

/**
 * Whether a period page should ask for the indicator: due by frequency, or already holding a value. An indicator that
 * is not due and has no value is "not due this month", never "needs attention".
 */
export function expectedInPeriod(input: { frequency: string | null | undefined; window: FrequencyWindow; hasValue: boolean; isFinalPeriod?: boolean }): boolean {
  return input.hasValue || isDueInPeriod(input.frequency, input.window, { isFinalPeriod: input.isFinalPeriod });
}
