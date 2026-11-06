/**
 * What the finance screens say about money, as pure functions: amounts with their currency, lists of per-currency totals, and the plain
 * sentences for conversions, burn and advances. No React, no clock; the server gives the day, the page only formats.
 */
import { FINANCE_COPY as C } from "./finance-copy.ts";

export interface MoneyDto { minor: number; currency: string }

/** "USD 1,234.50": thousands grouped, two decimals, the currency always named. A negative amount keeps its sign before the number. */
export function formatMoney(a: MoneyDto): string {
  const sign = a.minor < 0 ? "-" : "";
  const abs = Math.abs(a.minor);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${a.currency} ${sign}${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** Several currencies on one line, never added together; empty means nothing recorded. */
export function formatMoneyList(list: ReadonlyArray<MoneyDto>): string {
  return list.length === 0 ? C.none : list.map(formatMoney).join(" · ");
}

export interface PrimaryTotal { total: MoneyDto | null; needsRate: Array<{ date: string; amount: MoneyDto }> }

/** A total in the reporting currency, or "Rate needed" with what is missing; never a partial total. */
export function formatPrimary(t: PrimaryTotal, primary: string): { text: string; hint: string | null } {
  if (t.total) return { text: formatMoney(t.total), hint: null };
  if (t.needsRate.length === 0) return { text: `${primary} 0.00`, hint: null };
  const from = [...new Set(t.needsRate.map((n) => n.amount.currency))].join(", ");
  return { text: C.rateNeeded, hint: C.rateNeededHint(t.needsRate.length, primary, from) };
}

export function burnSentence(gapPoints: number | null): string {
  if (gapPoints === null) return C.burnNone;
  if (Math.abs(gapPoints) < 0.5) return C.burnLevel;
  return gapPoints > 0 ? C.burnAhead(Math.round(gapPoints * 10) / 10) : C.burnBehind(Math.round(Math.abs(gapPoints) * 10) / 10);
}

export const ENTRY_STATUS_LABEL: Readonly<Record<string, string>> = { DRAFT: C.statusDraft, APPROVED: C.statusApproved, REJECTED: C.statusRejected };
export const DELIVERABLE_STATE_LABEL: Readonly<Record<string, string>> = { WAITING: C.stateWaiting, OVERDUE: C.stateOverdue, APPROVED: C.stateApproved, PAID: C.statePaid };

export interface AdvancePositionDto { outstandingMinor: number; ageDays: number | null; overdue: boolean; overAccounted: boolean; accountedMinor: number }

export function advanceStatus(p: AdvancePositionDto): { label: string; tone: "ok" | "warn" | "danger" } {
  if (p.overAccounted) return { label: C.overAccounted, tone: "warn" };
  if (p.ageDays === null) return { label: C.settled, tone: "ok" };
  if (p.overdue) return { label: `${C.overdue}: ${C.days(p.ageDays)}`, tone: "danger" };
  return { label: C.days(p.ageDays), tone: "warn" };
}

/** The first problem a typed amount would hit, so a form can say it before the server does. Mirrors the server's rule (positive, at most two decimals). */
export function amountProblem(text: string): string | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "Enter an amount such as 1200 or 12.50";
  return Number(cleaned) <= 0 ? "The amount must be more than zero" : null;
}

export const todayText = (now: Date): string => now.toISOString().slice(0, 10);

/** Currencies suggested while typing a code; any three-letter code is accepted. */
export const COMMON_CURRENCIES: readonly string[] = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "KES", "UGX", "TZS", "ETB", "SDG", "SSP", "NGN", "GHS", "ZAR", "INR", "PKR", "BDT", "NPR", "UAH", "SYP", "YER", "AFN", "IQD", "LBP", "JOD", "TRY", "XOF", "XAF"];
