/**
 * The expenses-and-disbursements register (Phase 34.6). Pure rules: what counts as spent, what an advance still owes, how a register
 * adds up. Only APPROVED expenses count as spent (a draft or rejected one is listed and counted apart); a disbursement is money received
 * from a funder; an advance is money given out that must be accounted for. Totals are per currency; a converted total exists only when
 * every amount has a dated rate, and the ones that do not are named — never dropped, never guessed.
 */
import { convert, type CurrencyRate, type RateUsed } from "./currency-rate.js";
import { sumByCurrency, type Amount } from "./money.js";

export type EntryStatus = "DRAFT" | "APPROVED" | "REJECTED";

export interface Expense {
  id: string;
  /** The budget line it is booked against; none = not yet classified. */
  budgetLineId?: string | undefined;
  /** YYYY-MM-DD. */
  date: string;
  vendor: string;
  amount: Amount;
  status: EntryStatus;
  /** A file that proves it (an evidence id). */
  evidenceId?: string | undefined;
}

export interface Disbursement {
  id: string;
  fundingSourceId: string;
  date: string;
  amount: Amount;
  status: EntryStatus;
}

export interface AdvanceAccounting { date: string; amount: Amount }

export interface Advance {
  id: string;
  /** Who holds it (a person or partner), as written. */
  heldBy: string;
  givenOn: string;
  amount: Amount;
  /** What has been accounted for so far (receipts, returned cash). */
  accounted: AdvanceAccounting[];
}

export const DEFAULT_ADVANCE_OVERDUE_DAYS = 30;

const DAY_MS = 86_400_000;
export const calendarDaysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export interface AdvancePosition {
  given: Amount;
  accountedMinor: number;
  outstandingMinor: number;
  /** Accounted for more than was given: flagged for a person, never silently clamped. */
  overAccounted: boolean;
  /** Days since it was given while anything is outstanding; null once settled. */
  ageDays: number | null;
  overdue: boolean;
}

export function advancePosition(advance: Advance, today: string, overdueAfterDays = DEFAULT_ADVANCE_OVERDUE_DAYS): AdvancePosition {
  const accountedMinor = advance.accounted.filter((a) => a.amount.currency === advance.amount.currency).reduce((n, a) => n + a.amount.minor, 0);
  const outstandingMinor = advance.amount.minor - accountedMinor;
  const ageDays = outstandingMinor > 0 ? Math.max(0, calendarDaysBetween(advance.givenOn, today)) : null;
  return { given: advance.amount, accountedMinor, outstandingMinor: Math.max(0, outstandingMinor), overAccounted: outstandingMinor < 0, ageDays, overdue: ageDays !== null && ageDays > overdueAfterDays };
}

export interface RegisterTotals {
  /** Approved expenses, per currency. */
  spent: Amount[];
  /** Received from funders (approved), per currency. */
  disbursed: Amount[];
  /** Expenses waiting for approval (not counted as spent), per currency. */
  pending: Amount[];
  rejectedCount: number;
  /** Amount still out on advance, per currency. */
  outstandingAdvances: Amount[];
  unclassifiedExpenses: number;
  /** Approved expenses with no file behind them: a prompt, never a block. */
  withoutEvidence: number;
}

export interface RegisterInput { expenses: ReadonlyArray<Expense>; disbursements: ReadonlyArray<Disbursement>; advances: ReadonlyArray<Advance>; today: string }

export function registerTotals(input: RegisterInput): RegisterTotals {
  const approved = input.expenses.filter((e) => e.status === "APPROVED");
  return {
    spent: sumByCurrency(approved.map((e) => e.amount)),
    disbursed: sumByCurrency(input.disbursements.filter((d) => d.status === "APPROVED").map((d) => d.amount)),
    pending: sumByCurrency(input.expenses.filter((e) => e.status === "DRAFT").map((e) => e.amount)),
    rejectedCount: input.expenses.filter((e) => e.status === "REJECTED").length,
    outstandingAdvances: sumByCurrency(input.advances.map((a) => ({ minor: advancePosition(a, input.today).outstandingMinor, currency: a.amount.currency })).filter((m) => m.minor > 0)),
    unclassifiedExpenses: approved.filter((e) => !e.budgetLineId).length,
    withoutEvidence: approved.filter((e) => !e.evidenceId).length,
  };
}

export interface ConvertedTotal {
  total: Amount | null;
  /** Each amount's conversion, with the rate used: shown beside the figure. */
  lines: Array<{ date: string; from: Amount; to: Amount; used: RateUsed }>;
  /** Amounts that had no rate on their date: the total is then null (a partial total would read as the whole). */
  needsRate: Array<{ date: string; amount: Amount }>;
}

/** A total in one currency, each amount converted at the rate dated on its own transaction day. Null when any amount has no rate. */
export function convertedTotal(items: ReadonlyArray<{ date: string; amount: Amount }>, to: string, rates: ReadonlyArray<CurrencyRate>): ConvertedTotal {
  const lines: ConvertedTotal["lines"] = [];
  const needsRate: ConvertedTotal["needsRate"] = [];
  for (const item of items) {
    const c = convert(item.amount, to, item.date, rates);
    if (c.ok) lines.push({ date: item.date, from: item.amount, to: c.money, used: c.used });
    else needsRate.push(item);
  }
  if (needsRate.length > 0) return { total: null, lines, needsRate };
  return { total: { minor: lines.reduce((n, l) => n + l.to.minor, 0), currency: to }, lines, needsRate };
}

/** Whether an entry may still be edited: only a draft; an approved or rejected one is corrected by a new entry (the register keeps its history). */
export const canEditEntry = (status: EntryStatus): boolean => status === "DRAFT";
