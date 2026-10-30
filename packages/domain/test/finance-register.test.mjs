import test from "node:test";
import assert from "node:assert/strict";
import {
  advancePosition, budgetVsActual, burnReading, canEditEntry, checkRate, convert, convertedTotal, costPerResult, rateOn, registerTotals, sumByCurrency, timeElapsedPercent, formatMinorUnits,
} from "../dist/index.js";

const rate = (from, to, r, effectiveOn) => ({ id: `${from}${to}${effectiveOn}`, from, to, rate: r, effectiveOn, source: "treasury" });
const usd = (minor) => ({ minor, currency: "USD" });
const eur = (minor) => ({ minor, currency: "EUR" });

test("amounts of different currencies are never added together", () => {
  assert.deepEqual(sumByCurrency([usd(100), eur(50), usd(25)]), [usd(125), eur(50)]);
  assert.equal(formatMinorUnits(123450), "1234.50");
  assert.equal(formatMinorUnits(-5), "-0.05");
});

test("a rate is checked: codes, distinct currencies, a positive number with at most 8 decimals, a day", () => {
  const ok = { from: "EUR", to: "USD", rate: "1.0850", effectiveOn: "2026-01-01" };
  assert.equal(checkRate(ok), null);
  assert.match(checkRate({ ...ok, to: "EUR" }), /different/);
  assert.match(checkRate({ ...ok, rate: "0" }), /more than zero/);
  assert.match(checkRate({ ...ok, rate: "1.123456789" }), /8 decimals/);
  assert.match(checkRate({ ...ok, from: "eur" }), /three-letter/);
  assert.match(checkRate({ ...ok, effectiveOn: "Jan" }), /day/);
});

test("the rate in force on the day is the latest on or before it; a future rate is never used", () => {
  const rates = [rate("EUR", "USD", "1.00", "2026-01-01"), rate("EUR", "USD", "1.10", "2026-03-01")];
  assert.equal(rateOn(rates, "EUR", "USD", "2026-02-15").rate, "1.00");
  assert.equal(rateOn(rates, "EUR", "USD", "2026-03-01").rate, "1.10");
  assert.equal(rateOn(rates, "EUR", "USD", "2025-12-31"), null);
});

test("an opposite-pair rate is inverted and says so; a more recent direct rate wins", () => {
  const rates = [rate("USD", "EUR", "0.50", "2026-01-01")];
  const used = rateOn(rates, "EUR", "USD", "2026-02-01");
  assert.equal(used.inverted, true);
  const c = convert(eur(1000), "USD", "2026-02-01", rates);
  assert.equal(c.money.minor, 2000);
  const both = [rate("USD", "EUR", "0.50", "2026-01-01"), rate("EUR", "USD", "2.10", "2026-02-01")];
  assert.equal(rateOn(both, "EUR", "USD", "2026-02-10").inverted, false);
});

test("conversion rounds half away from zero to the minor unit and carries the rate used", () => {
  const rates = [rate("EUR", "USD", "1.085", "2026-01-01")];
  const c = convert(eur(1001), "USD", "2026-01-05", rates);
  assert.equal(c.ok, true);
  assert.equal(c.money.minor, 1086); // 1001 × 1.085 = 1086.085
  assert.equal(c.used.effectiveOn, "2026-01-01");
  assert.equal(convert(eur(-1001), "USD", "2026-01-05", rates).money.minor, -1086);
  assert.equal(convert(usd(500), "USD", "2026-01-05", []).money.minor, 500);
});

test("no rate means 'Rate needed', never a guess", () => {
  const c = convert(eur(100), "USD", "2026-01-05", []);
  assert.equal(c.ok, false);
  assert.equal(c.reason, "RATE_NEEDED");
  assert.match(c.message, /EUR to USD on 2026-01-05/);
});

test("a converted total uses each transaction's own dated rate, and is null when any amount lacks one", () => {
  const rates = [rate("EUR", "USD", "1.00", "2026-01-01"), rate("EUR", "USD", "2.00", "2026-02-01")];
  const t = convertedTotal([{ date: "2026-01-10", amount: eur(100) }, { date: "2026-02-10", amount: eur(100) }], "USD", rates);
  assert.equal(t.total.minor, 300);
  const partial = convertedTotal([{ date: "2025-12-01", amount: eur(100) }, { date: "2026-02-10", amount: eur(100) }], "USD", rates);
  assert.equal(partial.total, null);
  assert.equal(partial.needsRate.length, 1);
});

const exp = (id, status, extra = {}) => ({ id, date: "2026-02-01", vendor: "V", amount: usd(100), status, ...extra });
test("only approved expenses count as spent; drafts are pending, rejected ones are counted apart", () => {
  const t = registerTotals({
    expenses: [exp("a", "APPROVED", { budgetLineId: "l", evidenceId: "f" }), exp("b", "DRAFT"), exp("c", "REJECTED"), exp("d", "APPROVED")],
    disbursements: [{ id: "x", fundingSourceId: "s", date: "2026-01-01", amount: usd(1000), status: "APPROVED" }, { id: "y", fundingSourceId: "s", date: "2026-01-02", amount: usd(500), status: "DRAFT" }],
    advances: [], today: "2026-03-01",
  });
  assert.deepEqual(t.spent, [usd(200)]);
  assert.deepEqual(t.pending, [usd(100)]);
  assert.deepEqual(t.disbursed, [usd(1000)]);
  assert.equal(t.rejectedCount, 1);
  assert.equal(t.unclassifiedExpenses, 1);
  assert.equal(t.withoutEvidence, 1);
});

test("an advance's outstanding amount, age and overdue flag; settled has no age; over-accounting is flagged, not clamped away", () => {
  const adv = { id: "a", heldBy: "Field team", givenOn: "2026-01-01", amount: usd(1000), accounted: [{ date: "2026-01-10", amount: usd(400) }] };
  const p = advancePosition(adv, "2026-03-01");
  assert.equal(p.outstandingMinor, 600);
  assert.equal(p.ageDays, 59);
  assert.equal(p.overdue, true);
  assert.equal(advancePosition(adv, "2026-01-20").overdue, false);
  const settled = advancePosition({ ...adv, accounted: [{ date: "2026-01-10", amount: usd(1000) }] }, "2026-03-01");
  assert.equal(settled.ageDays, null);
  assert.equal(settled.overdue, false);
  const over = advancePosition({ ...adv, accounted: [{ date: "2026-01-10", amount: usd(1200) }] }, "2026-03-01");
  assert.equal(over.overAccounted, true);
  assert.equal(over.outstandingMinor, 0);
  // Accounting in another currency is not mixed into the advance.
  assert.equal(advancePosition({ ...adv, accounted: [{ date: "2026-01-10", amount: eur(900) }] }, "2026-02-01").outstandingMinor, 1000);
});

test("burn sets spending beside time, makes no projection, and has no percentage without a budget", () => {
  const b = burnReading({ budgetMinor: 10000, spentMinor: 6000, start: "2026-01-01", end: "2026-01-31", today: "2026-01-16" });
  assert.equal(b.spentPercent, 60);
  assert.equal(b.timeElapsedPercent, 50);
  assert.equal(b.gapPoints, 10);
  assert.equal(burnReading({ budgetMinor: null, spentMinor: 5, start: "2026-01-01", end: "2026-01-31", today: "2026-01-16" }).spentPercent, null);
  assert.equal(timeElapsedPercent("2026-01-01", "2026-01-31", "2025-12-01"), 0);
  assert.equal(timeElapsedPercent("2026-01-01", "2026-01-31", "2027-01-01"), 100);
  assert.equal(timeElapsedPercent("2026-01-31", "2026-01-01", "2026-01-10"), null);
});

test("budget against actual flags an overspend and has no share for a line with no budget", () => {
  const rows = budgetVsActual([{ lineId: "a", code: "1.1", budget: usd(1000), spentMinor: 1200 }, { lineId: "b", code: "1.2", budget: usd(0), spentMinor: 0 }]);
  assert.equal(rows[0].overspent, true);
  assert.equal(rows[0].remainingMinor, -200);
  assert.equal(rows[1].spentPercent, null);
});

test("cost per result is computed only for additive indicators with a positive achievement and real spending", () => {
  assert.deepEqual(costPerResult({ spent: usd(10000), achievement: 50, additive: true }), { computed: true, perUnitMinor: 200, currency: "USD" });
  for (const bad of [{ spent: usd(10000), achievement: 50, additive: false }, { spent: usd(10000), achievement: 0, additive: true }, { spent: usd(10000), achievement: null, additive: true }, { spent: null, achievement: 5, additive: true }, { spent: usd(0), achievement: 5, additive: true }]) {
    assert.equal(costPerResult(bad).computed, false);
  }
});

test("only a draft entry may be edited", () => {
  assert.equal(canEditEntry("DRAFT"), true);
  assert.equal(canEditEntry("APPROVED"), false);
  assert.equal(canEditEntry("REJECTED"), false);
});

import { budgetStatusBars, checkDeliverableChange, deliverableState, financeIndex, registerRows } from "../dist/index.js";

test("the finance index counts only own-funding sources, per currency; other funding is listed apart", () => {
  const idx = financeIndex({
    sources: [{ id: "s1", name: "Donor", ownFunding: true }, { id: "s2", name: "Govt cost-share", ownFunding: false }],
    fundings: [{ id: "f1", fundingSourceId: "s1", date: "2026-01-01", amount: usd(10000) }, { id: "f2", fundingSourceId: "s2", date: "2026-01-01", amount: usd(4000) }, { id: "f3", fundingSourceId: "s1", date: "2026-01-01", amount: eur(500) }],
    disbursements: [{ id: "d1", fundingSourceId: "s1", date: "2026-02-01", amount: usd(3000), status: "APPROVED" }, { id: "d2", fundingSourceId: "s1", date: "2026-02-02", amount: usd(999), status: "DRAFT" }, { id: "d3", fundingSourceId: "s2", date: "2026-02-03", amount: usd(100), status: "APPROVED" }],
    expenses: [exp("e1", "APPROVED"), exp("e2", "DRAFT")],
  });
  assert.deepEqual(idx.obligated, [usd(10000), eur(500)]);
  assert.deepEqual(idx.disbursed, [usd(3000)]);
  assert.deepEqual(idx.remaining, [usd(7000), eur(500)]);
  assert.deepEqual(idx.otherFunding, [usd(4000)]);
  assert.deepEqual(idx.spent, [usd(100)]);
});

test("the register runs a balance per currency, in date order, and only approved entries move it", () => {
  const rows = registerRows({
    expenses: [{ ...exp("e1", "APPROVED"), date: "2026-02-10", amount: usd(300) }, { ...exp("e2", "DRAFT"), date: "2026-02-11", amount: usd(50) }, { ...exp("e3", "APPROVED"), date: "2026-02-12", amount: eur(20) }],
    disbursements: [{ id: "d1", fundingSourceId: "s", date: "2026-02-01", amount: usd(1000), status: "APPROVED" }],
    today: "2026-03-01",
  });
  assert.deepEqual(rows.map((r) => r.id), ["d1", "e1", "e2", "e3"]);
  assert.deepEqual(rows.map((r) => r.balanceMinor), [1000, 700, 700, -20]);
  assert.equal(rows[0].ageDays, 28);
});

test("a deliverable is waiting, overdue, approved or paid; approval and payment follow their rules", () => {
  const d = { id: "x", name: "Baseline", amount: usd(100), dueOn: "2026-02-01" };
  assert.equal(deliverableState(d, "2026-01-15"), "WAITING");
  assert.equal(deliverableState(d, "2026-03-01"), "OVERDUE");
  const approved = { ...d, approvedById: "u2", approvedAt: "2026-02-05T10:00:00Z" };
  assert.equal(deliverableState(approved, "2026-03-01"), "APPROVED");
  assert.equal(deliverableState({ ...approved, paidOn: "2026-02-10" }, "2026-03-01"), "PAID");
  assert.match(checkDeliverableChange(d, { approve: true, byId: "u1", at: "t", createdById: "u1", separateApprover: true }), /Someone else/);
  assert.equal(checkDeliverableChange(d, { approve: true, byId: "u1", at: "t", createdById: "u1", separateApprover: false }), null);
  assert.match(checkDeliverableChange(d, { pay: true, on: "2026-02-10" }), /approved before/);
  assert.match(checkDeliverableChange(approved, { pay: true, on: "2026-02-01" }), /before the approval/);
  assert.equal(checkDeliverableChange(approved, { pay: true, on: "2026-02-10" }), null);
});

test("the budget status bars keep a missing budget or time as null, not zero", () => {
  const bars = budgetStatusBars({ budgetMinor: null, spentMinor: 5, disbursedMinor: 0, timeElapsedPercent: null });
  assert.deepEqual(bars.map((b) => b.value), [null, 5, 0, null]);
  assert.equal(bars[3].unit, "PERCENT");
});

import { Permissions, checkAdvance, checkAdvanceAccounting, checkBudgetCategory, checkDeliverable, checkDisbursement, checkFundingSourceName, checkProjectFunding, checkRegisterExpense } from "../dist/index.js";

test("typed amounts become whole minor units; zero, negatives and bad currencies are refused with a plain sentence", () => {
  const f = checkProjectFunding({ fundingSourceId: "s", date: "2026-02-01", amount: "1,200.50", currency: "usd" });
  assert.equal(f.ok, true);
  assert.deepEqual(f.value.amount, { minor: 120050, currency: "USD" });
  for (const amount of ["0", "-5", "abc", "1.234"]) assert.equal(checkProjectFunding({ fundingSourceId: "s", date: "2026-02-01", amount, currency: "USD" }).ok, false, amount);
  assert.match(checkProjectFunding({ fundingSourceId: "s", date: "2026-02-01", amount: "5", currency: "DOLLARS" }).error.message, /three-letter/);
  assert.match(checkProjectFunding({ fundingSourceId: "", date: "2026-02-01", amount: "5", currency: "USD" }).error.message, /funding source/);
  assert.equal(checkProjectFunding({ fundingSourceId: "s", date: "2026-02-30", amount: "5", currency: "USD" }).ok, false);
  assert.equal(checkDisbursement({ fundingSourceId: "s", date: "2026-02-01", amount: "5", currency: "USD", memo: " tranche 1 " }).value.memo, "tranche 1");
});

test("a register expense needs a day, an amount and who was paid, and defaults to the line's currency", () => {
  const e = checkRegisterExpense({ date: "2026-02-01", amount: "10", vendor: " Acme " }, "EUR");
  assert.deepEqual(e.value.amount, { minor: 1000, currency: "EUR" });
  assert.equal(e.value.vendor, "Acme");
  assert.equal(checkRegisterExpense({ date: "2026-02-01", amount: "10", vendor: "Acme", currency: "usd" }, "EUR").value.amount.currency, "USD");
  assert.match(checkRegisterExpense({ date: "2026-02-01", amount: "10", vendor: " " }, "EUR").error.message, /who was paid/);
});

test("names, categories, deliverables and advances are checked; accounting stays in the advance's currency and after it was given", () => {
  assert.equal(checkFundingSourceName("  ").ok, false);
  assert.equal(checkBudgetCategory({ code: "m&e", label: "x" }).ok, false);
  assert.equal(checkBudgetCategory({ code: "m-e", label: "Monitoring" }).value.code, "M-E");
  assert.equal(checkDeliverable({ name: "Baseline", amount: "100", currency: "USD", dueOn: "2026-03-01" }).ok, true);
  assert.equal(checkDeliverable({ name: "", amount: "100", currency: "USD", dueOn: "2026-03-01" }).ok, false);
  assert.equal(checkAdvance({ heldBy: "Field team", givenOn: "2026-01-01", amount: "500", currency: "USD" }).ok, true);
  const adv = { givenOn: "2026-01-10", currency: "USD" };
  assert.equal(checkAdvanceAccounting({ date: "2026-01-20", amount: "100", currency: "USD" }, adv).ok, true);
  assert.match(checkAdvanceAccounting({ date: "2026-01-05", amount: "100", currency: "USD" }, adv).error.message, /before/);
  assert.match(checkAdvanceAccounting({ date: "2026-01-20", amount: "100", currency: "EUR" }, adv).error.message, /in USD/);
});

test("only an administrator and a project manager may approve finance entries", () => {
  assert.equal(Permissions.can("ADMIN", "finance.approve"), true);
  assert.equal(Permissions.can("PROJECT_MANAGER", "finance.approve"), true);
  for (const role of ["ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"]) assert.equal(Permissions.can(role, "finance.approve"), false, role);
});

import { parseRegisterSheet, registerSheetErrorFile, registerSheetTemplate } from "../dist/index.js";

const sheetCtx = { lines: new Map([["1.1", { id: "L1", currency: "EUR" }]]), sources: new Map([["donor a", "s1"]]), primaryCurrency: "USD" };
const HEAD = "Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source";

test("a register sheet reads expenses and money received, takes the line's or the reporting currency by default, and skips the template's hint row", () => {
  const r = parseRegisterSheet(`${registerSheetTemplate()}Expense,2026-02-01,"1,200.50",,Acme,Fuel,1.1,\nMoney received,2026-02-02,5000,,,Tranche 1,,Donor A\n`, sheetCtx);
  assert.equal(r.invalid, 0);
  assert.equal(r.valid, 2);
  assert.deepEqual(r.rows[0].entry.amount, { minor: 120050, currency: "EUR" });
  assert.equal(r.rows[0].entry.budgetLineId, "L1");
  assert.equal(r.rows[1].entry.kind, "DISBURSEMENT");
  assert.deepEqual(r.rows[1].entry.amount, { minor: 500000, currency: "USD" });
});

test("every kind of bad row is named, and one bad row means nothing is importable", () => {
  const r = parseRegisterSheet(`${HEAD}\nGift,2026-02-01,5,,,,,\nExpense,2026-02-01,5,,Acme,,9.9,\nExpense,2026-02-01,5,,,,1.1,\nExpense,2026-02-01,abc,,Acme,,1.1,\nMoney received,2026-02-01,5,,,,,Nobody\nMoney received,2026-02-01,5,,,,,\nExpense,2026-02-01,5,,Acme,,1.1,Donor A\n`, sheetCtx);
  assert.equal(r.valid, 1);
  assert.equal(r.invalid, 6);
  assert.match(r.rows[0].problems[0], /Type must be/);
  assert.match(r.rows[1].problems[0], /No budget line has the code "9.9"/);
  assert.match(r.rows[2].problems[0], /who was paid/);
  assert.ok(r.rows[3].problems.length > 0);
  assert.match(r.rows[4].problems[0], /No funding source is named "Nobody"/);
  assert.match(r.rows[5].problems[0], /which funding source/);
});

test("an unknown column is reported, a missing required column blocks every row, and the error file is the person's sheet with a Problems column", () => {
  const unk = parseRegisterSheet(`${HEAD},Mood\nExpense,2026-02-01,5,,Acme,,1.1,,happy\n`, sheetCtx);
  assert.deepEqual(unk.unknownColumns, ["Mood"]);
  const missing = parseRegisterSheet("Date,Amount\n2026-02-01,5\n", sheetCtx);
  assert.deepEqual(missing.missingColumns, ["Type"]);
  assert.match(missing.rows[0].problems[0], /no column for Type/);
  const bad = parseRegisterSheet(`${HEAD}\nExpense,2026-02-01,5,,Acme,,1.1,\nGift,2026-02-01,5,,,,,\n`, sheetCtx);
  const file = registerSheetErrorFile(bad);
  assert.equal(file.trim().split("\n").length, 2);
  assert.match(file, /^Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source,Problems/);
  assert.match(file, /Gift,2026-02-01,5/);
  assert.equal(parseRegisterSheet("", sheetCtx).rows.length, 0);
});

import { portfolioFinance } from "../dist/index.js";
test("the portfolio adds every visible project's own funding per currency, counts projects without funding, and converts only with rates", () => {
  const sources = [{ id: "s1", name: "A", ownFunding: true }, { id: "s2", name: "B", ownFunding: false }];
  const base = { projectIds: ["p1", "p2", "p3"], sources, primaryCurrency: "USD", rates: [], expenses: [exp("e1", "APPROVED"), exp("e2", "DRAFT")] };
  const fundings = [{ id: "f1", projectId: "p1", fundingSourceId: "s1", date: "2026-01-01", amount: usd(1000) }, { id: "f2", projectId: "p2", fundingSourceId: "s1", date: "2026-01-01", amount: eur(500) }, { id: "f3", projectId: "p2", fundingSourceId: "s2", date: "2026-01-01", amount: usd(9) }];
  const disbursements = [{ id: "d1", fundingSourceId: "s1", date: "2026-02-01", amount: usd(300), status: "APPROVED" }, { id: "d2", fundingSourceId: "s1", date: "2026-02-01", amount: usd(40), status: "DRAFT" }];
  const p = portfolioFinance({ ...base, fundings, disbursements });
  assert.deepEqual(p.index.obligated, [usd(1000), eur(500)]);
  assert.deepEqual(p.index.disbursed, [usd(300)]);
  assert.deepEqual(p.index.spent, [usd(100)]);
  assert.equal(p.projects, 3);
  assert.equal(p.projectsWithFunding, 2);
  assert.equal(p.awaitingApproval, 2);
  assert.equal(p.inPrimary.obligated.total, null);
  const withRate = portfolioFinance({ ...base, fundings, disbursements, rates: [rate("EUR", "USD", "2.00", "2025-12-01")] });
  assert.deepEqual(withRate.inPrimary.obligated.total, usd(2000));
  assert.equal(portfolioFinance({ ...base, fundings: [], disbursements: [], expenses: [] }).projectsWithFunding, 0);
});
