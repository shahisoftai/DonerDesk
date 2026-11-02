/**
 * What the funding and the budget add up to (Phase 38.8), per currency — amounts in different currencies are never added —
 * and whether they agree. The budget total is the categories when the budget has them, else the most detailed rows (never
 * both, which would count everything twice). A stated grand total in the budget is compared by the same check the review
 * uses. A missing or unreadable amount is not 0: that line is left out of the total and counted. Pure.
 */
import { checkBudgetTotals, leafRows, parseAmount, BUDGET_TOLERANCE } from "../budget-checks.js";
import type { SetupDraft } from "./draft.js";
import { live } from "./requirements/shared.js";

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface FinanceDifference {
  currency: string;
  funding: number;
  budget: number;
}

export interface FinanceSummary {
  funding: CurrencyTotal[];
  budget: CurrencyTotal[];
  /** Currencies where both funding and budget exist and do not agree. */
  differences: FinanceDifference[];
  /** The budget does not add up to the grand total it states. */
  statedTotalMismatch: boolean;
  /** Lines (funding or budget) whose amount could not be read, so they are not in any total. */
  unreadable: number;
}

const add = (into: Map<string, number>, currency: string | null, amount: number | null): boolean => {
  if (amount === null || !currency) return false;
  into.set(currency, (into.get(currency) ?? 0) + amount);
  return true;
};
const totals = (m: Map<string, number>): CurrencyTotal[] => [...m.entries()].map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 })).sort((a, b) => a.currency.localeCompare(b.currency));

/** The budget rows that count towards its total: categories if there are any, else the most detailed rows; stated totals never. */
export function budgetTotalRows(draft: SetupDraft) {
  const rows = live(draft.proposal.budget).filter((b) => b.kind !== "TOTAL");
  const categories = rows.filter((b) => (b.kind ?? "LINE") === "LINE");
  return categories.length > 0 ? categories : leafRows(rows.filter((b) => b.kind === "DETAIL"));
}

export function financeSummary(draft: SetupDraft): FinanceSummary {
  const funding = new Map<string, number>();
  const budget = new Map<string, number>();
  let unreadable = 0;
  for (const f of live(draft.proposal.funding)) if (!add(funding, f.currency, parseAmount(f.amount))) unreadable += 1;
  for (const b of budgetTotalRows(draft)) if (!add(budget, b.currency, parseAmount(b.amount))) unreadable += 1;
  const differences = [...funding.entries()]
    .filter(([currency]) => budget.has(currency))
    .map(([currency, f]) => ({ currency, funding: Math.round(f * 100) / 100, budget: Math.round(budget.get(currency)! * 100) / 100 }))
    .filter((d) => Math.abs(d.funding - d.budget) > BUDGET_TOLERANCE);
  return { funding: totals(funding), budget: totals(budget), differences, statedTotalMismatch: checkBudgetTotals(draft.proposal).length > 0, unreadable };
}
