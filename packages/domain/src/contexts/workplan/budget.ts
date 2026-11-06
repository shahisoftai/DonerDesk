/**
 * Budget lines on a planned activity and the expenses booked against them (phase 28.1-D). Money is kept in minor units
 * (cents) as whole numbers, so sums never drift. A line with no amount says "No budget set"; it is never shown as zero spent
 * against zero budget, and an overspend is a flag, never a block.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { isPlainDate, type PlainDate } from "./plain-date.js";

export const BUDGET_COST_CATEGORIES = ["PERSONNEL", "TRAVEL", "SUPPLIES", "EQUIPMENT", "SERVICES", "OTHER"] as const;
export type BudgetCostCategory = (typeof BUDGET_COST_CATEGORIES)[number];

export const BUDGET_COST_CATEGORY_LABEL: Readonly<Record<BudgetCostCategory, string>> = {
  PERSONNEL: "Staff and volunteers", TRAVEL: "Travel", SUPPLIES: "Supplies", EQUIPMENT: "Equipment", SERVICES: "Services", OTHER: "Other",
};

export const MAX_BUDGET_MINOR = 1_000_000_000_000; // 10 billion in cents
export const MAX_BUDGET_LINES = 50;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** "12.50" → 1250. Refuses anything that is not a plain positive amount with at most two decimals. */
export function parseMinorAmount(text: string): Result<number> {
  const cleaned = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return err(DomainError.validation("Enter an amount such as 1200 or 12.50", { field: "amount" }));
  const minor = Math.round(Number(cleaned) * 100);
  if (minor <= 0) return err(DomainError.validation("The amount must be more than zero", { field: "amount" }));
  if (minor > MAX_BUDGET_MINOR) return err(DomainError.validation("That amount is too large", { field: "amount" }));
  return ok(minor);
}

export interface BudgetLineInput {
  code: string;
  category: BudgetCostCategory;
  description?: string;
  donorName?: string;
  currency: string;
  amount: string;
}

export interface ValidBudgetLine {
  code: string;
  category: BudgetCostCategory;
  description: string;
  donorName: string;
  currency: string;
  amountMinor: number;
}

export function checkBudgetLine(input: BudgetLineInput): Result<ValidBudgetLine> {
  const code = input.code.trim();
  if (!code) return err(DomainError.validation("Give the line a code, such as 2.1-T", { field: "code" }));
  if (code.length > 30) return err(DomainError.validation("Keep the code to 30 characters", { field: "code" }));
  if (!BUDGET_COST_CATEGORIES.includes(input.category)) return err(DomainError.validation("Choose a cost category", { field: "category" }));
  const currency = input.currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) return err(DomainError.validation("Use a three-letter currency code, such as USD", { field: "currency" }));
  const amount = parseMinorAmount(input.amount);
  if (!amount.ok) return amount;
  return ok({
    code, category: input.category, description: (input.description ?? "").trim(), donorName: (input.donorName ?? "").trim(),
    currency, amountMinor: amount.value,
  });
}

export interface BookedExpense { date: PlainDate; amountMinor: number }

export function checkExpense(input: { date: string; amount: string; description?: string }): Result<{ date: PlainDate; amountMinor: number; description: string }> {
  if (!isPlainDate(input.date)) return err(DomainError.validation("Choose the date of the expense", { field: "date" }));
  const amount = parseMinorAmount(input.amount);
  if (!amount.ok) return amount;
  return ok({ date: input.date, amountMinor: amount.value, description: (input.description ?? "").trim() });
}

export interface BudgetPosition {
  budgetedMinor: number | null;
  spentMinor: number;
  remainingMinor: number | null;
  /** Spent as a share of the budget, to one decimal place; null when no budget is set. */
  spentPercent: number | null;
  overspent: boolean;
  /** Plain words for the line's state. */
  state: "NO_BUDGET" | "NOT_STARTED" | "UNDER_SPENT" | "FULLY_SPENT" | "OVERSPENT";
}

/** Where a line stands: spent so far against its budget. Budgeting nothing is "No budget set", never a zero. */
export function budgetPosition(budgetedMinor: number | null, expenses: ReadonlyArray<BookedExpense>): BudgetPosition {
  const spentMinor = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
  if (budgetedMinor === null) return { budgetedMinor: null, spentMinor, remainingMinor: null, spentPercent: null, overspent: false, state: "NO_BUDGET" };
  const remainingMinor = budgetedMinor - spentMinor;
  const spentPercent = Math.round((spentMinor / budgetedMinor) * 1000) / 10;
  const overspent = remainingMinor < 0;
  const state = overspent ? "OVERSPENT" : spentMinor === 0 ? "NOT_STARTED" : remainingMinor === 0 ? "FULLY_SPENT" : "UNDER_SPENT";
  return { budgetedMinor, spentMinor, remainingMinor, spentPercent, overspent, state };
}

/** Money as the person reads it: "1,250.00 USD". */
export function formatMinor(minor: number, currency: string): string {
  const whole = Math.trunc(Math.abs(minor) / 100);
  const cents = String(Math.abs(minor) % 100).padStart(2, "0");
  return `${minor < 0 ? "-" : ""}${whole.toLocaleString("en-US")}.${cents} ${currency}`;
}

export interface ProjectBudgetLine { activityId: string; activityTitle: string; currency: string; budgetedMinor: number; spentMinor: number }

export interface ProjectBudgetActivity { activityId: string; activityTitle: string; budgetedMinor: number; spentMinor: number; remainingMinor: number; overspent: boolean }

export interface ProjectBudgetCurrency {
  currency: string;
  budgetedMinor: number;
  spentMinor: number;
  remainingMinor: number;
  /** How many activities spent more than their budget in this currency. */
  overspentActivities: number;
  byActivity: ProjectBudgetActivity[];
}

/**
 * A project's budget against what was spent, one block per currency (currencies are never added together) and one row per
 * activity (its lines in that currency added up). Activities with nothing budgeted do not appear; this is a view of what has a budget.
 */
export function projectBudgetSummary(lines: ReadonlyArray<ProjectBudgetLine>): ProjectBudgetCurrency[] {
  const byCurrency = new Map<string, Map<string, ProjectBudgetActivity>>();
  for (const l of lines) {
    const activities = byCurrency.get(l.currency) ?? new Map<string, ProjectBudgetActivity>();
    const row = activities.get(l.activityId) ?? { activityId: l.activityId, activityTitle: l.activityTitle, budgetedMinor: 0, spentMinor: 0, remainingMinor: 0, overspent: false };
    row.budgetedMinor += l.budgetedMinor;
    row.spentMinor += l.spentMinor;
    activities.set(l.activityId, row);
    byCurrency.set(l.currency, activities);
  }
  return [...byCurrency.entries()]
    .map(([currency, activities]) => {
      const byActivity = [...activities.values()]
        .map((a) => ({ ...a, remainingMinor: a.budgetedMinor - a.spentMinor, overspent: a.spentMinor > a.budgetedMinor }))
        .sort((a, b) => a.activityTitle.localeCompare(b.activityTitle));
      const budgetedMinor = byActivity.reduce((s, a) => s + a.budgetedMinor, 0);
      const spentMinor = byActivity.reduce((s, a) => s + a.spentMinor, 0);
      return { currency, budgetedMinor, spentMinor, remainingMinor: budgetedMinor - spentMinor, overspentActivities: byActivity.filter((a) => a.overspent).length, byActivity };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
