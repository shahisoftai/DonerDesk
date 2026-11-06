/**
 * Input checks for the finance register: what a person types is checked here, once, before any handler stores it. Amounts are typed as
 * text ("1200", "12.50"), turned into whole minor units, and never negative or zero. Dates are plain days; a name is trimmed and bounded.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { parseMinorAmount } from "../workplan/budget.js";
import { CURRENCY_CODE, type Amount } from "./money.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bad = (message: string, field: string) => err(DomainError.validation(message, { field }));

export const MAX_FINANCE_NAME = 120;

function checkAmount(amount: string, currency: string): Result<Amount> {
  const code = currency.trim().toUpperCase();
  if (!CURRENCY_CODE.test(code)) return bad("Use a three-letter currency code, such as USD.", "currency");
  const minor = parseMinorAmount(amount);
  if (!minor.ok) return minor;
  return ok({ minor: minor.value, currency: code });
}

function checkDay(value: string, message: string, field: string): Result<string> {
  const day = value.trim();
  const t = Date.parse(`${day}T00:00:00Z`);
  return DAY.test(day) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day ? ok(day) : bad(message, field);
}

function checkText(value: string | undefined, message: string, field: string, max = MAX_FINANCE_NAME): Result<string> {
  const text = (value ?? "").trim();
  return text.length === 0 || text.length > max ? bad(message, field) : ok(text);
}

export const checkFundingSourceName = (name: string): Result<string> => checkText(name, `Give the funding source a name of up to ${MAX_FINANCE_NAME} characters.`, "name");

export function checkBudgetCategory(input: { code: string; label: string }): Result<{ code: string; label: string }> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(code)) return bad("A category code is 2 to 30 letters, digits, - or _.", "code");
  const label = checkText(input.label, `Give the category a name of up to ${MAX_FINANCE_NAME} characters.`, "label");
  return label.ok ? ok({ code, label: label.value }) : label;
}

export interface FundingInput { fundingSourceId: string; date: string; amount: string; currency: string; note?: string }
export function checkProjectFunding(input: FundingInput): Result<{ fundingSourceId: string; date: string; amount: Amount; note: string }> {
  if (!input.fundingSourceId) return bad("Choose a funding source.", "fundingSourceId");
  const date = checkDay(input.date, "Choose the date of the allocation.", "date");
  if (!date.ok) return date;
  const amount = checkAmount(input.amount, input.currency);
  if (!amount.ok) return amount;
  return ok({ fundingSourceId: input.fundingSourceId, date: date.value, amount: amount.value, note: (input.note ?? "").trim().slice(0, 300) });
}

export interface DisbursementInput { fundingSourceId: string; date: string; amount: string; currency: string; memo?: string }
export function checkDisbursement(input: DisbursementInput): Result<{ fundingSourceId: string; date: string; amount: Amount; memo: string }> {
  const f = checkProjectFunding({ ...input, ...(input.memo !== undefined ? { note: input.memo } : {}) });
  return f.ok ? ok({ fundingSourceId: f.value.fundingSourceId, date: f.value.date, amount: f.value.amount, memo: f.value.note }) : f;
}

export interface RegisterExpenseInput { date: string; amount: string; currency?: string; vendor: string; memo?: string; fundingSourceId?: string; evidenceId?: string }
/** `lineCurrency` is the budget line's currency: an expense is in it unless another is given (and converted later at its day's rate). */
export function checkRegisterExpense(input: RegisterExpenseInput, lineCurrency: string): Result<{ date: string; amount: Amount; vendor: string; memo: string; fundingSourceId?: string; evidenceId?: string }> {
  const date = checkDay(input.date, "Choose the date of the expense.", "date");
  if (!date.ok) return date;
  const amount = checkAmount(input.amount, input.currency ?? lineCurrency);
  if (!amount.ok) return amount;
  const vendor = checkText(input.vendor, "Say who was paid.", "vendor", 160);
  if (!vendor.ok) return vendor;
  return ok({ date: date.value, amount: amount.value, vendor: vendor.value, memo: (input.memo ?? "").trim().slice(0, 300), ...(input.fundingSourceId ? { fundingSourceId: input.fundingSourceId } : {}), ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}) });
}

export function checkDeliverable(input: { name: string; amount: string; currency: string; dueOn: string }): Result<{ name: string; amount: Amount; dueOn: string }> {
  const name = checkText(input.name, "Name the deliverable.", "name");
  if (!name.ok) return name;
  const amount = checkAmount(input.amount, input.currency);
  if (!amount.ok) return amount;
  const dueOn = checkDay(input.dueOn, "Choose the due date.", "dueOn");
  return dueOn.ok ? ok({ name: name.value, amount: amount.value, dueOn: dueOn.value }) : dueOn;
}

export function checkAdvance(input: { heldBy: string; givenOn: string; amount: string; currency: string; note?: string }): Result<{ heldBy: string; givenOn: string; amount: Amount; note: string }> {
  const heldBy = checkText(input.heldBy, "Say who holds the advance.", "heldBy", 160);
  if (!heldBy.ok) return heldBy;
  const givenOn = checkDay(input.givenOn, "Choose the date it was given.", "givenOn");
  if (!givenOn.ok) return givenOn;
  const amount = checkAmount(input.amount, input.currency);
  return amount.ok ? ok({ heldBy: heldBy.value, givenOn: givenOn.value, amount: amount.value, note: (input.note ?? "").trim().slice(0, 300) }) : amount;
}

export function checkAdvanceAccounting(input: { date: string; amount: string; currency: string; note?: string }, advance: { givenOn: string; currency: string }): Result<{ date: string; amount: Amount; note: string }> {
  const date = checkDay(input.date, "Choose the date.", "date");
  if (!date.ok) return date;
  if (date.value < advance.givenOn) return bad("Accounting cannot be dated before the advance was given.", "date");
  const amount = checkAmount(input.amount, input.currency);
  if (!amount.ok) return amount;
  if (amount.value.currency !== advance.currency) return bad(`Account for this advance in ${advance.currency}.`, "currency");
  return ok({ date: date.value, amount: amount.value, note: (input.note ?? "").trim().slice(0, 300) });
}
