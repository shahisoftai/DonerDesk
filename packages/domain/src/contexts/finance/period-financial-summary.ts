import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import {
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalMultiply,
  decimalSubtract,
  formatDecimal,
  parseDecimal,
  type Decimal,
} from "../reporting/indicator-calculator.js";

export type FinanceSource = "TYPED" | "IMPORT";
export type FinanceVerification = "DRAFT" | "VERIFIED";

/** One budget line of a period's financial summary. Amounts are decimal strings. */
export interface FinanceLine {
  budgetLine: string;
  budget: string;
  expenditure: string;
  committed?: string;
}

export interface FinanceFigures {
  /** Empty means the period's totals are given directly. */
  lines: FinanceLine[];
  budget: string;
  expenditure: string;
  committed?: string;
}

const MAX_LINES = 200;
const ZERO: Decimal = { value: 0n, scale: 0 };

/**
 * Parses an amount as typed or pasted: spaces and commas are thousands separators
 * ("1,200.50"), a dot is the decimal point, negative amounts are not allowed.
 */
export function parseMoney(text: string | undefined): Decimal | null {
  if (typeof text !== "string") return null;
  const d = parseDecimal(text.replace(/[,\s]/g, ""));
  return d === null || decimalCompare(d, ZERO) < 0 ? null : d;
}

const money = (d: Decimal): string => formatDecimal(d, 2);

function requireMoney(text: string | undefined, label: string): Decimal {
  const d = parseMoney(text);
  if (d === null) throw DomainError.validation(`${label} must be a non-negative amount`, { value: text });
  return d;
}

/**
 * Validates and normalises the figures of a summary. With budget lines the
 * totals are their sums (totals cannot be given separately, so they can never
 * disagree); without lines the totals are required.
 */
export function normalizeFinanceFigures(input: { lines?: ReadonlyArray<FinanceLine>; budget?: string; expenditure?: string; committed?: string }): FinanceFigures {
  const lines = input.lines ?? [];
  if (lines.length > MAX_LINES) throw DomainError.validation(`At most ${MAX_LINES} budget lines`);
  if (lines.length === 0) {
    const committed = input.committed === undefined || input.committed.trim() === "" ? undefined : money(requireMoney(input.committed, "Committed"));
    return { lines: [], budget: money(requireMoney(input.budget, "Budget")), expenditure: money(requireMoney(input.expenditure, "Expenditure")), ...(committed ? { committed } : {}) };
  }
  const seen = new Set<string>();
  let budget = ZERO;
  let expenditure = ZERO;
  let committed: Decimal | undefined;
  const normalized = lines.map((l, i): FinanceLine => {
    const name = l.budgetLine.trim();
    if (!name) throw DomainError.validation(`Budget line ${i + 1} needs a name`);
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) throw DomainError.validation(`Budget line "${name}" appears twice`);
    seen.add(key);
    const b = requireMoney(l.budget, `Budget of "${name}"`);
    const e = requireMoney(l.expenditure, `Expenditure of "${name}"`);
    const c = l.committed === undefined || l.committed.trim() === "" ? undefined : requireMoney(l.committed, `Committed of "${name}"`);
    budget = decimalAdd(budget, b);
    expenditure = decimalAdd(expenditure, e);
    if (c) committed = decimalAdd(committed ?? ZERO, c);
    return { budgetLine: name.slice(0, 120), budget: money(b), expenditure: money(e), ...(c ? { committed: money(c) } : {}) };
  });
  return { lines: normalized, budget: money(budget), expenditure: money(expenditure), ...(committed ? { committed: money(committed) } : {}) };
}

export interface FinanceLineSummary {
  budgetLine: string;
  budget: string;
  expenditure: string;
  committed?: string;
  /** budget − expenditure (negative when overspent). */
  balance: string;
  /** expenditure ÷ budget × 100, one decimal; absent when the budget is zero. */
  burnRatePercent?: string;
}

export interface FinanceSummaryView {
  currency: string;
  budget: string;
  expenditure: string;
  committed?: string;
  balance: string;
  burnRatePercent?: string;
  lines: FinanceLineSummary[];
}

function derive(budget: string, expenditure: string): { balance: string; burnRatePercent?: string } {
  const b = parseDecimal(budget) ?? ZERO;
  const e = parseDecimal(expenditure) ?? ZERO;
  const rate = decimalDivide(e, b, 6);
  return { balance: money(decimalSubtract(b, e)), ...(rate ? { burnRatePercent: formatDecimal(decimalMultiply(rate, { value: 100n, scale: 0 }), 1) } : {}) };
}

/** The figures a report writer is given: entered amounts plus the balance and burn rate computed here, never by the writer. */
export function summarizeFinance(currency: string, figures: FinanceFigures): FinanceSummaryView {
  return {
    currency,
    budget: figures.budget,
    expenditure: figures.expenditure,
    ...(figures.committed ? { committed: figures.committed } : {}),
    ...derive(figures.budget, figures.expenditure),
    lines: figures.lines.map((l) => ({ ...l, ...derive(l.budget, l.expenditure) })),
  };
}

export function normalizeCurrency(value: string | undefined): string {
  const c = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) throw DomainError.validation("Currency must be a 3-letter code (for example USD)");
  return c;
}

export interface PeriodFinancialSummaryProps extends FinanceFigures {
  projectId: string;
  reportingPeriodId: string;
  currency: string;
  source: FinanceSource;
  sourceNote?: string;
  verificationStatus: FinanceVerification;
  verifiedById?: string;
  verifiedAt?: Date;
  createdById: string;
  updatedById: string;
}

/**
 * A period's financial figures. Any change to the figures drops the
 * verification: only figures a person confirmed are sent to a report writer.
 */
export class PeriodFinancialSummary extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: PeriodFinancialSummaryProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    currency: string;
    source: FinanceSource;
    sourceNote?: string;
    figures: { lines?: ReadonlyArray<FinanceLine>; budget?: string; expenditure?: string; committed?: string };
    createdById: string;
  }): PeriodFinancialSummary {
    const figures = normalizeFinanceFigures(input.figures);
    return new PeriodFinancialSummary(input.id, input.tenantId, {
      projectId: input.projectId,
      reportingPeriodId: input.reportingPeriodId,
      currency: normalizeCurrency(input.currency),
      ...figures,
      source: input.source,
      ...(input.sourceNote?.trim() ? { sourceNote: input.sourceNote.trim().slice(0, 300) } : {}),
      verificationStatus: "DRAFT",
      createdById: input.createdById,
      updatedById: input.createdById,
    });
  }

  static rehydrate(input: { id: string; tenantId: string; props: PeriodFinancialSummaryProps; createdAt: Date; updatedAt?: Date }): PeriodFinancialSummary {
    return new PeriodFinancialSummary(input.id, input.tenantId, input.props, input.createdAt, input.updatedAt);
  }

  get projectId(): string { return this.props.projectId; }
  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get currency(): string { return this.props.currency; }
  get figures(): FinanceFigures {
    return { lines: this.props.lines.map((l) => ({ ...l })), budget: this.props.budget, expenditure: this.props.expenditure, ...(this.props.committed ? { committed: this.props.committed } : {}) };
  }
  get source(): FinanceSource { return this.props.source; }
  get sourceNote(): string | undefined { return this.props.sourceNote; }
  get verificationStatus(): FinanceVerification { return this.props.verificationStatus; }
  get verifiedById(): string | undefined { return this.props.verifiedById; }
  get verifiedAt(): Date | undefined { return this.props.verifiedAt; }
  get createdById(): string { return this.props.createdById; }
  get updatedById(): string { return this.props.updatedById; }
  get isVerified(): boolean { return this.props.verificationStatus === "VERIFIED"; }

  /** The figures plus balance and burn rate, for display and for the writers. */
  view(): FinanceSummaryView {
    return summarizeFinance(this.props.currency, this.figures);
  }

  /** Replaces the figures; the summary is unverified again until someone confirms the new figures. */
  replaceFigures(input: { currency?: string; source: FinanceSource; sourceNote?: string; figures: { lines?: ReadonlyArray<FinanceLine>; budget?: string; expenditure?: string; committed?: string }; updatedById: string }): void {
    const figures = normalizeFinanceFigures(input.figures);
    const currency = input.currency === undefined ? this.props.currency : normalizeCurrency(input.currency);
    this.props = {
      ...this.props,
      ...figures,
      currency,
      source: input.source,
      sourceNote: input.sourceNote?.trim() ? input.sourceNote.trim().slice(0, 300) : undefined,
      verificationStatus: "DRAFT",
      verifiedById: undefined,
      verifiedAt: undefined,
      updatedById: input.updatedById,
    } as PeriodFinancialSummaryProps;
    this.touch();
  }

  verify(userId: string, at: Date = new Date()): void {
    if (this.props.verificationStatus === "VERIFIED") throw DomainError.invalidTransition("The financial figures are already verified");
    this.props.verificationStatus = "VERIFIED";
    this.props.verifiedById = userId;
    this.props.verifiedAt = at;
    this.props.updatedById = userId;
    this.touch();
  }
}
