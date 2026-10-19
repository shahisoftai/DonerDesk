import test from "node:test";
import assert from "node:assert/strict";
import { checkBudgetLine, checkExpense, budgetPosition, parseMinorAmount, formatMinor, MAX_BUDGET_MINOR } from "../dist/index.js";

test("amounts are kept as whole cents: 12.50 is 1250 and nothing with more than two decimals gets in", () => {
  assert.deepEqual(parseMinorAmount("12.50"), { ok: true, value: 1250 });
  assert.deepEqual(parseMinorAmount("1,200"), { ok: true, value: 120000 });
  assert.equal(parseMinorAmount("12.505").ok, false);
  assert.equal(parseMinorAmount("0").ok, false);
  assert.equal(parseMinorAmount("-5").ok, false);
  assert.equal(parseMinorAmount("12abc").ok, false);
  assert.equal(parseMinorAmount(String(MAX_BUDGET_MINOR)).ok, false, "too large");
});

test("a budget line needs a code, a category and a three-letter currency", () => {
  const good = checkBudgetLine({ code: " 2.1-T ", category: "TRAVEL", currency: "usd", amount: "500", donorName: "EU" });
  assert.deepEqual(good.value, { code: "2.1-T", category: "TRAVEL", description: "", donorName: "EU", currency: "USD", amountMinor: 50000 });
  assert.equal(checkBudgetLine({ code: "", category: "TRAVEL", currency: "USD", amount: "1" }).ok, false);
  assert.equal(checkBudgetLine({ code: "x", category: "TRAVEL", currency: "DOLLARS", amount: "1" }).ok, false);
  assert.equal(checkBudgetLine({ code: "x", category: "CAKE", currency: "USD", amount: "1" }).ok, false);
});

test("an expense needs a real date and a positive amount", () => {
  assert.equal(checkExpense({ date: "2026-02-30", amount: "10" }).ok, false);
  assert.equal(checkExpense({ date: "2026-11-04", amount: "" }).ok, false);
  assert.deepEqual(checkExpense({ date: "2026-11-04", amount: "10.5", description: " fuel " }).value, { date: "2026-11-04", amountMinor: 1050, description: "fuel" });
});

test("a line with no budget says so; it is never shown as zero spent against zero budget", () => {
  const none = budgetPosition(null, [{ date: "2026-11-04", amountMinor: 500 }]);
  assert.equal(none.state, "NO_BUDGET");
  assert.equal(none.remainingMinor, null);
  assert.equal(none.overspent, false, "a flag is not raised without a budget");
});

test("spent against budget: not started, under, fully spent and overspent (a flag, not a block)", () => {
  assert.equal(budgetPosition(10000, []).state, "NOT_STARTED");
  const under = budgetPosition(10000, [{ date: "2026-11-04", amountMinor: 4000 }]);
  assert.deepEqual([under.spentMinor, under.remainingMinor, under.spentPercent, under.state], [4000, 6000, 40, "UNDER_SPENT"]);
  assert.equal(budgetPosition(10000, [{ date: "2026-11-04", amountMinor: 10000 }]).state, "FULLY_SPENT");
  const over = budgetPosition(10000, [{ date: "2026-11-04", amountMinor: 12050 }]);
  assert.equal(over.overspent, true);
  assert.equal(over.remainingMinor, -2050);
  assert.equal(over.state, "OVERSPENT");
});

test("money reads back with cents and a currency", () => {
  assert.equal(formatMinor(125000, "USD"), "1,250.00 USD");
  assert.equal(formatMinor(5, "EUR"), "0.05 EUR");
  assert.equal(formatMinor(-2050, "USD"), "-20.50 USD");
});
