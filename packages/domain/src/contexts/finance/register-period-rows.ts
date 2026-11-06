import type { Amount } from "./money.js";

/**
 * Finance figures per reporting period taken from the finance register (not from a period summary): the budget line a chart needs.
 * Rules, all from the register: only the organisation's own funding is "budget" (obligated up to the period end), only APPROVED expenses are spent
 * (cumulative to the period end, like a period summary), one currency or nothing at all (currencies never add, and no conversion is guessed), and a
 * period with no funding and no spending yet has no row. Burn is spending beside the budget, never a projection.
 */
export interface RegisterPeriodRow { periodId: string; currency: string; budget: string; expenditure: string; balance: string; burnRatePercent?: string; verified: boolean }

const money = (minor: number): string => (minor / 100).toFixed(2);

export function registerPeriodRows(input: {
  periods: ReadonlyArray<{ id: string; end: string }>;
  /** Own funding only: `date` is the day it was committed. */
  funding: ReadonlyArray<{ date: string; amount: Amount }>;
  /** Approved expenses only. */
  expenses: ReadonlyArray<{ date: string; amount: Amount }>;
}): RegisterPeriodRow[] {
  const currencies = new Set([...input.funding, ...input.expenses].map((x) => x.amount.currency));
  if (currencies.size !== 1) return [];
  const currency = [...currencies][0]!;
  const rows: RegisterPeriodRow[] = [];
  for (const p of input.periods) {
    const budgetMinor = input.funding.filter((f) => f.date <= p.end).reduce((s, f) => s + f.amount.minor, 0);
    const spentMinor = input.expenses.filter((e) => e.date <= p.end).reduce((s, e) => s + e.amount.minor, 0);
    const anyFunding = input.funding.some((f) => f.date <= p.end);
    const anySpend = input.expenses.some((e) => e.date <= p.end);
    if (!anyFunding && !anySpend) continue;
    rows.push({
      periodId: p.id, currency, budget: anyFunding ? money(budgetMinor) : "", expenditure: money(spentMinor), balance: anyFunding ? money(budgetMinor - spentMinor) : "",
      ...(anyFunding && budgetMinor > 0 ? { burnRatePercent: (Math.round((spentMinor / budgetMinor) * 1000) / 10).toFixed(1) } : {}), verified: true,
    });
  }
  return rows;
}
