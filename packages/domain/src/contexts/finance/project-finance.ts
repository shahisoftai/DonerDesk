/**
 * The project finance index and the register's running columns (the way DevResults presents a project's money, with our honesty rules).
 *
 * Funding sources are an organisation list; a source flagged `ownFunding` counts towards the project's headline figures, the others
 * (cost-share, leveraged funds) are shown but not added in. Obligated = the funding sources' amounts, Disbursed = approved disbursements,
 * Remaining = Obligated − Disbursed, Spent = approved expenses. Everything is per currency: a figure in the organisation's primary currency
 * exists only when every amount has a dated rate (`convertedTotal`), otherwise it is null and the amounts missing a rate are named.
 */
import type { CurrencyRate } from "./currency-rate.js";
import { sumByCurrency, type Amount } from "./money.js";
import { calendarDaysBetween, convertedTotal, type Disbursement, type Expense } from "./register.js";

export interface FundingSource {
  id: string;
  name: string;
  /** Counts towards the headline figures. */
  ownFunding: boolean;
}

/** A project's allocation from a funding source (what DevResults calls the Funding Sources table row). */
export interface ProjectFunding { id: string; fundingSourceId: string; date: string; amount: Amount }

export interface FinanceIndex {
  obligated: Amount[];
  disbursed: Amount[];
  /** Per currency: obligated − disbursed, only where both exist in that currency. */
  remaining: Amount[];
  spent: Amount[];
  /** Funding from sources not flagged as own funding: listed, never added in. */
  otherFunding: Amount[];
}

export function financeIndex(input: { sources: ReadonlyArray<FundingSource>; fundings: ReadonlyArray<ProjectFunding>; disbursements: ReadonlyArray<Disbursement>; expenses: ReadonlyArray<Expense> }): FinanceIndex {
  const own = new Set(input.sources.filter((s) => s.ownFunding).map((s) => s.id));
  const obligated = sumByCurrency(input.fundings.filter((f) => own.has(f.fundingSourceId)).map((f) => f.amount));
  const disbursed = sumByCurrency(input.disbursements.filter((d) => d.status === "APPROVED" && own.has(d.fundingSourceId)).map((d) => d.amount));
  const remaining = obligated.map((o) => ({ currency: o.currency, minor: o.minor - (disbursed.find((d) => d.currency === o.currency)?.minor ?? 0) }));
  return {
    obligated, disbursed, remaining,
    spent: sumByCurrency(input.expenses.filter((e) => e.status === "APPROVED").map((e) => e.amount)),
    otherFunding: sumByCurrency(input.fundings.filter((f) => !own.has(f.fundingSourceId)).map((f) => f.amount)),
  };
}

/** One figure in the primary currency, or null with the amounts that lacked a rate: used for obligated, disbursed and spent on a dashboard. */
export function inPrimaryCurrency(items: ReadonlyArray<{ date: string; amount: Amount }>, primary: string, rates: ReadonlyArray<CurrencyRate>) {
  return convertedTotal(items, primary, rates);
}

export interface RegisterRow {
  id: string;
  date: string;
  kind: "EXPENSE" | "DISBURSEMENT";
  memo: string;
  amount: Amount;
  /** Cumulative (disbursed − spent) in this row's currency up to and including this row: the cash position, never mixed across currencies. */
  balanceMinor: number;
  /** Days between the row's date and today. */
  ageDays: number;
}

/** The register in date order with a running balance per currency. Only approved entries move the balance; the others are listed with the balance as it was. */
export function registerRows(input: { expenses: ReadonlyArray<Expense & { memo?: string }>; disbursements: ReadonlyArray<Disbursement & { memo?: string }>; today: string }): RegisterRow[] {
  const all = [
    ...input.expenses.map((e) => ({ id: e.id, date: e.date, kind: "EXPENSE" as const, memo: e.memo ?? e.vendor, amount: e.amount, counts: e.status === "APPROVED" })),
    ...input.disbursements.map((d) => ({ id: d.id, date: d.date, kind: "DISBURSEMENT" as const, memo: d.memo ?? "", amount: d.amount, counts: d.status === "APPROVED" })),
  ].sort((a, b) => (a.date === b.date ? (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "DISBURSEMENT" ? -1 : 1) : a.date < b.date ? -1 : 1));
  const balances = new Map<string, number>();
  return all.map((r) => {
    const cur = r.amount.currency;
    const before = balances.get(cur) ?? 0;
    const next = r.counts ? before + (r.kind === "DISBURSEMENT" ? r.amount.minor : -r.amount.minor) : before;
    balances.set(cur, next);
    return { id: r.id, date: r.date, kind: r.kind, memo: r.memo, amount: r.amount, balanceMinor: next, ageDays: Math.max(0, calendarDaysBetween(r.date, input.today)) };
  });
}

export interface Deliverable {
  id: string;
  name: string;
  amount: Amount;
  dueOn: string;
  approvedById?: string | undefined;
  approvedAt?: string | undefined;
  paidOn?: string | undefined;
}

export type DeliverableState = "WAITING" | "OVERDUE" | "APPROVED" | "PAID";

export function deliverableState(d: Deliverable, today: string): DeliverableState {
  if (d.paidOn) return "PAID";
  if (d.approvedAt) return "APPROVED";
  return d.dueOn < today ? "OVERDUE" : "WAITING";
}

/** Approving records who and when. A person may not approve their own deliverable payment if `separateApprover` is set; payment needs approval first. */
export function checkDeliverableChange(d: Deliverable, change: { approve: true; byId: string; at: string; createdById: string; separateApprover: boolean } | { pay: true; on: string }): string | null {
  if ("approve" in change) {
    if (d.approvedAt) return "This deliverable is already approved.";
    if (change.separateApprover && change.byId === change.createdById) return "Someone else must approve this deliverable.";
    return null;
  }
  if (!d.approvedAt) return "A deliverable is approved before it is marked as paid.";
  if (d.paidOn) return "This deliverable is already marked as paid.";
  if (change.on < d.approvedAt.slice(0, 10)) return "The payment date cannot be before the approval.";
  return null;
}

export interface BudgetStatusBar { key: "BUDGET" | "SPENT" | "DISBURSED" | "TIME_ELAPSED"; label: string; value: number | null; unit: "MINOR" | "PERCENT" }

/** The bars of DevResults' "Budget Status", in one currency: budget, expenses to date, disbursed to date, and time elapsed as a percentage of the project. */
export function budgetStatusBars(input: { budgetMinor: number | null; spentMinor: number; disbursedMinor: number; timeElapsedPercent: number | null }): BudgetStatusBar[] {
  return [
    { key: "BUDGET", label: "Budget", value: input.budgetMinor, unit: "MINOR" },
    { key: "SPENT", label: "Expenses to date", value: input.spentMinor, unit: "MINOR" },
    { key: "DISBURSED", label: "Disbursed to date", value: input.disbursedMinor, unit: "MINOR" },
    { key: "TIME_ELAPSED", label: "Time elapsed", value: input.timeElapsedPercent, unit: "PERCENT" },
  ];
}

export interface PortfolioFinance {
  index: FinanceIndex;
  /** Obligated, received and spent in the reporting currency: null with the amounts missing a rate. */
  inPrimary: Record<"obligated" | "disbursed" | "spent", ReturnType<typeof convertedTotal>>;
  projects: number;
  /** Projects with at least one funding row: the rest are counted, never treated as zero funding. */
  projectsWithFunding: number;
  /** Draft expenses and disbursements waiting for a decision. */
  awaitingApproval: number;
}

/**
 * The same figures as one project's index, over every project the person can see. Own funding only; per currency; a reporting-currency total only when
 * every amount has a dated rate. Pure: the handler brings the rows.
 */
export function portfolioFinance(input: {
  projectIds: ReadonlyArray<string>;
  sources: ReadonlyArray<FundingSource>;
  fundings: ReadonlyArray<ProjectFunding & { projectId: string }>;
  disbursements: ReadonlyArray<Disbursement>;
  expenses: ReadonlyArray<Expense>;
  rates: ReadonlyArray<CurrencyRate>;
  primaryCurrency: string;
}): PortfolioFinance {
  const index = financeIndex({ sources: input.sources, fundings: input.fundings, disbursements: input.disbursements, expenses: input.expenses });
  const own = new Set(input.sources.filter((s) => s.ownFunding).map((s) => s.id));
  const inPrimary = {
    obligated: convertedTotal(input.fundings.filter((f) => own.has(f.fundingSourceId)).map((f) => ({ date: f.date, amount: f.amount })), input.primaryCurrency, input.rates),
    disbursed: convertedTotal(input.disbursements.filter((d) => d.status === "APPROVED" && own.has(d.fundingSourceId)).map((d) => ({ date: d.date, amount: d.amount })), input.primaryCurrency, input.rates),
    spent: convertedTotal(input.expenses.filter((e) => e.status === "APPROVED").map((e) => ({ date: e.date, amount: e.amount })), input.primaryCurrency, input.rates),
  };
  return {
    index, inPrimary,
    projects: input.projectIds.length,
    projectsWithFunding: new Set(input.fundings.map((f) => f.projectId)).size,
    awaitingApproval: input.expenses.filter((e) => e.status === "DRAFT").length + input.disbursements.filter((d) => d.status === "DRAFT").length,
  };
}
