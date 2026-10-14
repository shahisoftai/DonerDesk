/**
 * What the indicator grid can offer instead of asking again: the last recorded value of each indicator, and a running
 * total when the indicator really is a running sum. Pure and conservative - a suggestion needs numbers on both sides
 * and an indicator that adds up; anything else is left for the person to enter.
 */

export interface PreviousIndicatorValue {
  periodAchievement: string;
  cumulativeAchievement: string;
  dataSource?: string;
  /** End of the period the value belongs to, ISO date. */
  periodEnd: string;
}

export interface DatedPeriodRef {
  id: string;
  start: Date;
  end: Date;
}

export interface RecordedValue {
  indicatorId: string;
  reportingPeriodId: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  dataSource?: string | undefined;
}

/**
 * For each indicator, its value from the latest period that ended before `currentStart` and has a recorded value.
 * Periods are passed in already filtered to those that count (not cancelled, comparable); order does not matter.
 */
export function latestPreviousValues(
  periods: ReadonlyArray<DatedPeriodRef>,
  values: ReadonlyArray<RecordedValue>,
  currentStart: Date,
): Map<string, PreviousIndicatorValue> {
  const earlier = periods.filter((p) => p.end.getTime() < currentStart.getTime());
  const endOf = new Map(earlier.map((p) => [p.id, p.end]));
  const best = new Map<string, { end: Date; value: RecordedValue }>();
  for (const v of values) {
    const end = endOf.get(v.reportingPeriodId);
    if (!end || v.periodAchievement.trim() === "") continue;
    const current = best.get(v.indicatorId);
    if (!current || end.getTime() > current.end.getTime()) best.set(v.indicatorId, { end, value: v });
  }
  return new Map(
    [...best].map(([id, { end, value }]) => [
      id,
      {
        periodAchievement: value.periodAchievement,
        cumulativeAchievement: value.cumulativeAchievement,
        ...(value.dataSource ? { dataSource: value.dataSource } : {}),
        periodEnd: end.toISOString().slice(0, 10),
      },
    ]),
  );
}

/** "1,240" and "1 240" read as numbers; "40%", "n/a" and "" do not. */
export function parseEntryNumber(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const cleaned = text.trim().replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function plain(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/**
 * The running total after this period: the previous running total plus this period's value, only for an indicator that
 * adds up (SUM). Rates, ratios, "latest" readings and yes/no values never get one.
 */
export function suggestRunningTotal(input: {
  aggregation: string;
  periodValue: string;
  previousCumulative: string | undefined;
}): string | undefined {
  if (input.aggregation !== "SUM") return undefined;
  const period = parseEntryNumber(input.periodValue);
  const previous = parseEntryNumber(input.previousCumulative);
  if (period === undefined || previous === undefined) return undefined;
  return plain(previous + period);
}

/**
 * The running total to show after the period value changed. A person's own entry is never replaced: the field is only
 * (re)filled while it is empty or still holds the suggestion made for the previous keystroke.
 */
export function nextRunningTotal(input: {
  aggregation: string;
  periodValue: string;
  currentCumulative: string;
  previousCumulative: string | undefined;
  lastSuggestion: string | undefined;
}): { cumulative: string; suggestion: string | undefined } {
  const suggestion = suggestRunningTotal({ aggregation: input.aggregation, periodValue: input.periodValue, previousCumulative: input.previousCumulative });
  const untouched = input.currentCumulative.trim() === "" || input.currentCumulative === input.lastSuggestion;
  if (!untouched) return { cumulative: input.currentCumulative, suggestion };
  return { cumulative: suggestion ?? (input.currentCumulative === input.lastSuggestion ? "" : input.currentCumulative), suggestion };
}
