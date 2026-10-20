import assert from "node:assert/strict";
import test from "node:test";
import { cleanProgramme, cleanGrant, summarizeFunding } from "../dist/index.js";

test("H-2: a programme needs a name and is active by default", () => {
  assert.deepEqual(cleanProgramme({ name: "  Horn of Africa  ", code: " HOA " }), { name: "Horn of Africa", code: "HOA", description: undefined, status: "ACTIVE" });
  assert.throws(() => cleanProgramme({ name: " " }), /name/);
  assert.throws(() => cleanProgramme({ name: "x" }), /name/);
});

test("H-2: a grant needs a title and a donor; an amount needs a currency and must be positive", () => {
  const g = cleanGrant({ title: "WASH 2026", donorName: "USAID", amount: "250,000.50", currency: "usd", startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.equal(g.amount, "250000.50");
  assert.equal(g.currency, "USD");
  assert.equal(g.status, "ACTIVE");
  assert.throws(() => cleanGrant({ title: "", donorName: "USAID" }), /title/);
  assert.throws(() => cleanGrant({ title: "t", donorName: "" }), /donor/);
  assert.throws(() => cleanGrant({ title: "t", donorName: "d", amount: "0", currency: "USD" }), /positive/);
  assert.throws(() => cleanGrant({ title: "t", donorName: "d", amount: "abc", currency: "USD" }), /positive/);
  assert.throws(() => cleanGrant({ title: "t", donorName: "d", amount: "10" }), /currency/);
  assert.throws(() => cleanGrant({ title: "t", donorName: "d", startDate: "2026-06-01", endDate: "2026-01-01" }), /before it starts/);
  assert.equal(cleanGrant({ title: "t", donorName: "d" }).amount, undefined);
});

test("H-2: totals keep currencies apart and never add a missing budget as zero", () => {
  const totals = summarizeFunding(
    [
      { id: "a", title: "A", status: "ACTIVE", budget: { amount: 1000.5, currency: "USD" } },
      { id: "b", title: "B", status: "ACTIVE", budget: { amount: "2000", currency: "USD" } },
      { id: "c", title: "C", status: "COMPLETED", budget: { amount: 500, currency: "EUR" } },
      { id: "d", title: "D", status: "ACTIVE" },
    ],
    [{ amount: "10000", currency: "USD" }, { amount: "5000", currency: "EUR" }, { amount: undefined, currency: undefined }],
  );
  assert.deepEqual(totals, { projectCount: 4, activeProjectCount: 3, budgetByCurrency: { USD: 3000.5, EUR: 500 }, awardedByCurrency: { USD: 10000, EUR: 5000 } });
});
