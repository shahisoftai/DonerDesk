import { test } from "node:test";
import assert from "node:assert/strict";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import { FINANCE_COPY } from "../../src/features/finance/domain/finance-copy.ts";
import { advanceStatus, amountProblem, burnSentence, formatMoney, formatMoneyList, formatPrimary } from "../../src/features/finance/domain/finance-view.ts";

test("money is grouped, always two decimals, always names its currency, and keeps a negative sign", () => {
  assert.equal(formatMoney({ minor: 123450, currency: "USD" }), "USD 1,234.50");
  assert.equal(formatMoney({ minor: 5, currency: "EUR" }), "EUR 0.05");
  assert.equal(formatMoney({ minor: -250000, currency: "USD" }), "USD -2,500.00");
  assert.equal(formatMoney({ minor: 500000000000, currency: "USD" }), "USD 5,000,000,000.00");
});

test("per-currency lists are never added together, and an empty one says none", () => {
  assert.equal(formatMoneyList([{ minor: 100, currency: "USD" }, { minor: 200, currency: "EUR" }]), "USD 1.00 · EUR 2.00");
  assert.equal(formatMoneyList([]), FINANCE_COPY.none);
});

test("a total in the reporting currency says 'Rate needed' and what is missing, never a partial figure", () => {
  assert.equal(formatPrimary({ total: { minor: 1000, currency: "USD" }, needsRate: [] }, "USD").text, "USD 10.00");
  const missing = formatPrimary({ total: null, needsRate: [{ date: "2026-01-01", amount: { minor: 5, currency: "EUR" } }, { date: "2026-01-02", amount: { minor: 5, currency: "EUR" } }] }, "USD");
  assert.equal(missing.text, "Rate needed");
  assert.match(missing.hint ?? "", /2 amounts could not be converted to USD: add the EUR rate for their days/);
  assert.equal(formatPrimary({ total: null, needsRate: [] }, "USD").text, "USD 0.00");
});

test("burn is said plainly: ahead, behind, level, or nothing to compare", () => {
  assert.match(burnSentence(12.34), /12.3 points ahead/);
  assert.match(burnSentence(-5), /5 points behind/);
  assert.equal(burnSentence(0.2), FINANCE_COPY.burnLevel);
  assert.equal(burnSentence(null), FINANCE_COPY.burnNone);
});

test("an advance reads settled, aged, overdue or over-accounted", () => {
  assert.equal(advanceStatus({ outstandingMinor: 0, ageDays: null, overdue: false, overAccounted: false, accountedMinor: 5 }).label, FINANCE_COPY.settled);
  assert.equal(advanceStatus({ outstandingMinor: 5, ageDays: 10, overdue: false, overAccounted: false, accountedMinor: 0 }).tone, "warn");
  assert.equal(advanceStatus({ outstandingMinor: 5, ageDays: 40, overdue: true, overAccounted: false, accountedMinor: 0 }).tone, "danger");
  assert.equal(advanceStatus({ outstandingMinor: 0, ageDays: null, overdue: false, overAccounted: true, accountedMinor: 9 }).label, FINANCE_COPY.overAccounted);
});

test("a typed amount is checked as the server will", () => {
  assert.equal(amountProblem(""), null);
  assert.equal(amountProblem("1,200.50"), null);
  assert.ok(amountProblem("12.345"));
  assert.ok(amountProblem("0"));
  assert.ok(amountProblem("abc"));
});

test("no finance string a person reads carries a raw code, id or snake_case key", () => {
  const strings: string[] = [];
  for (const v of Object.values(FINANCE_COPY)) strings.push(typeof v === "function" ? (v as (...a: never[]) => string)(...([2, "USD", "EUR"].slice(0, v.length) as never[])) : v);
  assert.ok(strings.length > 80);
  assert.deepEqual(strings.filter((s) => findRawTokens(String(s)).length > 0), []);
});
