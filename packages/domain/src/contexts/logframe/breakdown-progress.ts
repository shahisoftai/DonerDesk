/**
 * Targets by group beside what has been verified so far (gap closure). For each group an indicator has a target for (Women,
 * Girls under 5 …), the verified figure for that group and how far along it is. Only VERIFIED values count, the same rule as
 * the cross-project roll-up. A group nobody has reported on is blank, never zero; a group's target that is not a number is shown
 * without a percentage.
 *
 * A summable indicator (a count) adds the group across periods; any other (a rate, a ratio) takes the latest period.
 */
import { disaggregationMustSum, type DisaggregationEntry } from "./indicator-disaggregation.js";
import type { IndicatorType } from "./indicator.js";

export interface BreakdownUpdate {
  /** The reporting period's end date (yyyy-mm-dd): which update is the latest. */
  periodEnd: string;
  verified: boolean;
  entries: ReadonlyArray<DisaggregationEntry>;
}

export interface BreakdownProgressRow {
  dimension: string;
  category: string;
  target: number | null;
  /** The verified figure for the group, or null when none has been reported. */
  actual: number | null;
  /** Actual as a share of target to one decimal place; null for a rate, a blank figure, or a target that is not above zero. */
  percentOfTarget: number | null;
  /** How many verified periods reported this group. */
  periods: number;
}

const toNumber = (text: string): number | null => {
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export function breakdownProgress(input: { type: IndicatorType; targets: ReadonlyArray<DisaggregationEntry>; updates: ReadonlyArray<BreakdownUpdate> }): BreakdownProgressRow[] {
  const verified = input.updates.filter((u) => u.verified).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const sums = disaggregationMustSum(input.type);
  return input.targets.map((t) => {
    const reported = verified
      .map((u) => u.entries.find((e) => e.dimension === t.dimension && same(e.category, t.category)))
      .map((e) => (e ? toNumber(e.value) : null))
      .filter((n): n is number => n !== null);
    const actual = reported.length === 0 ? null : sums ? reported.reduce((a, b) => a + b, 0) : reported[reported.length - 1]!;
    const target = toNumber(t.value);
    const percentOfTarget = actual !== null && target !== null && target > 0 && input.type !== "PERCENTAGE" ? Math.round((actual / target) * 1000) / 10 : null;
    return { dimension: t.dimension, category: t.category, target, actual, percentOfTarget, periods: reported.length };
  });
}
