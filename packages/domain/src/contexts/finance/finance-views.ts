/**
 * Views over the register that must stay honest: burn (spend set beside time, never projected), budget against actual by line, and cost per
 * result (only for additive indicators with an achievement; otherwise "not computed" and why).
 */
import { calendarDaysBetween } from "./register.js";
import type { Amount } from "./money.js";

export interface BurnReading {
  /** Spent as a share of the budget, one decimal; null with no budget. */
  spentPercent: number | null;
  /** How much of the project's time has passed, one decimal (clamped 0–100). */
  timeElapsedPercent: number | null;
  /** spentPercent − timeElapsedPercent in points, so a reader sees "ahead of" or "behind" the clock. No projection is made. */
  gapPoints: number | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function timeElapsedPercent(start: string, end: string, today: string): number | null {
  const total = calendarDaysBetween(start, end);
  if (total <= 0) return null;
  return round1(Math.min(100, Math.max(0, (calendarDaysBetween(start, today) / total) * 100)));
}

export function burnReading(input: { budgetMinor: number | null; spentMinor: number; start: string; end: string; today: string }): BurnReading {
  const spentPercent = input.budgetMinor && input.budgetMinor > 0 ? round1((input.spentMinor / input.budgetMinor) * 100) : null;
  const timeElapsed = timeElapsedPercent(input.start, input.end, input.today);
  return { spentPercent, timeElapsedPercent: timeElapsed, gapPoints: spentPercent !== null && timeElapsed !== null ? round1(spentPercent - timeElapsed) : null };
}

export interface BudgetLineRow { lineId: string; code: string; budget: Amount; spentMinor: number }

export interface BudgetVsActualRow {
  lineId: string;
  code: string;
  budget: Amount;
  spentMinor: number;
  /** Budget − spent; negative = overspent (a flag, never a block). */
  remainingMinor: number;
  spentPercent: number | null;
  overspent: boolean;
}

/** One row per line in the line's own currency. Spend booked in another currency is not mixed in: pass it already converted, or leave it out and say so. */
export function budgetVsActual(lines: ReadonlyArray<BudgetLineRow>): BudgetVsActualRow[] {
  return lines.map((l) => ({
    lineId: l.lineId, code: l.code, budget: l.budget, spentMinor: l.spentMinor,
    remainingMinor: l.budget.minor - l.spentMinor,
    spentPercent: l.budget.minor > 0 ? round1((l.spentMinor / l.budget.minor) * 100) : null,
    overspent: l.spentMinor > l.budget.minor,
  }));
}

export type CostPerResult = { computed: true; perUnitMinor: number; currency: string } | { computed: false; reason: string };

/** Spend ÷ achievement, for additive indicators only. A rate, a missing or zero achievement, or nothing spent is "not computed", never 0 or infinity. */
export function costPerResult(input: { spent: Amount | null; achievement: number | null; additive: boolean }): CostPerResult {
  if (!input.additive) return { computed: false, reason: "A rate or percentage cannot be divided into a cost." };
  if (input.spent === null || input.spent.minor <= 0) return { computed: false, reason: "No spending is recorded against this result yet." };
  if (input.achievement === null) return { computed: false, reason: "No result is recorded yet." };
  if (input.achievement <= 0) return { computed: false, reason: "The recorded result is zero, so a cost per result cannot be worked out." };
  return { computed: true, perUnitMinor: Math.round(input.spent.minor / input.achievement), currency: input.spent.currency };
}
