import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMoney, normalizeFinanceFigures, summarizeFinance, PeriodFinancialSummary, parseFinanceRows,
  financeAppliesTo, normalizeFinanceDataMode, blueprintSectionsFor, ReportingProfile,
} from "../dist/index.js";

test("finance data mode: unknown values mean DISABLED, and it applies only to cadence reports with a financial section", () => {
  assert.equal(normalizeFinanceDataMode("TYPED"), "TYPED");
  assert.equal(normalizeFinanceDataMode("nonsense"), "DISABLED");
  assert.equal(normalizeFinanceDataMode(undefined), "DISABLED");
  assert.equal(financeAppliesTo("DISABLED", "QUARTERLY"), false);
  assert.equal(financeAppliesTo("TYPED", "QUARTERLY"), true);
  for (const t of ["MONTHLY", "ACTIVITY", "SITUATION", "CUSTOM"]) assert.equal(financeAppliesTo("IMPORT", t), false, t);
});

test("reporting profile: finance mode defaults to DISABLED, validates, and updates", () => {
  const p = ReportingProfile.create({ id: "p", tenantId: "tenant-a", projectId: "proj", createdById: "u" });
  assert.equal(p.financeDataMode, "DISABLED");
  p.update({ financeDataMode: "IMPORT", updatedById: "u" });
  assert.equal(p.financeDataMode, "IMPORT");
  p.update({ tone: "CONCISE", updatedById: "u" });
  assert.equal(p.financeDataMode, "IMPORT", "an update that does not mention it leaves it alone");
  assert.throws(() => p.update({ financeDataMode: "NOPE", updatedById: "u" }), /finance data mode/);
});

test("parseMoney reads thousands separators and rejects negatives and text", () => {
  assert.equal(parseMoney("1,200.50")?.value, 120050n);
  assert.equal(parseMoney(" 45 000 ")?.value, 45000n);
  assert.equal(parseMoney("-5"), null);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(undefined), null);
});

test("totals given directly are normalised; committed is optional", () => {
  assert.deepEqual(normalizeFinanceFigures({ budget: "10,000", expenditure: "2500.50" }), { lines: [], budget: "10000", expenditure: "2500.5" });
  assert.equal(normalizeFinanceFigures({ budget: "10", expenditure: "1", committed: "3" }).committed, "3");
  assert.throws(() => normalizeFinanceFigures({ expenditure: "1" }), /Budget must be/);
  assert.throws(() => normalizeFinanceFigures({ budget: "1", expenditure: "-1" }), /Expenditure must be/);
});

test("with budget lines the totals are their sums and cannot disagree", () => {
  const f = normalizeFinanceFigures({
    lines: [{ budgetLine: "Staff", budget: "6,000", expenditure: "2,000", committed: "500" }, { budgetLine: "Supplies", budget: "4000", expenditure: "1250.5" }],
    budget: "999", // ignored: totals are derived
  });
  assert.equal(f.budget, "10000");
  assert.equal(f.expenditure, "3250.5");
  assert.equal(f.committed, "500");
  assert.throws(() => normalizeFinanceFigures({ lines: [{ budgetLine: " ", budget: "1", expenditure: "1" }] }), /needs a name/);
  assert.throws(() => normalizeFinanceFigures({ lines: [{ budgetLine: "A", budget: "1", expenditure: "1" }, { budgetLine: " a ", budget: "1", expenditure: "1" }] }), /twice/);
});

test("summary view computes balance and burn rate (one decimal) and never divides by a zero budget", () => {
  const v = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Staff", budget: "6000", expenditure: "2000" }, { budgetLine: "Unfunded", budget: "0", expenditure: "10" }] }));
  assert.equal(v.balance, "3990");
  assert.equal(v.burnRatePercent, "33.5");
  assert.deepEqual(v.lines.map((l) => [l.budgetLine, l.balance, l.burnRatePercent]), [["Staff", "4000", "33.3"], ["Unfunded", "-10", undefined]]);
});

test("any change to the figures drops the verification", () => {
  const s = PeriodFinancialSummary.create({ id: "f", tenantId: "tenant-a", projectId: "p", reportingPeriodId: "r", currency: "usd", source: "TYPED", figures: { budget: "100", expenditure: "10" }, createdById: "u1" });
  assert.equal(s.currency, "USD");
  assert.equal(s.isVerified, false);
  s.verify("u2");
  assert.equal(s.isVerified, true);
  assert.equal(s.verifiedById, "u2");
  assert.throws(() => s.verify("u2"), /already verified/);
  s.replaceFigures({ source: "TYPED", figures: { budget: "100", expenditure: "20" }, updatedById: "u1" });
  assert.equal(s.isVerified, false);
  assert.equal(s.verifiedById, undefined);
  assert.throws(() => PeriodFinancialSummary.create({ id: "f", tenantId: "tenant-a", projectId: "p", reportingPeriodId: "r", currency: "dollars", source: "TYPED", figures: { budget: "1", expenditure: "1" }, createdById: "u" }), /3-letter/);
});

test("spreadsheet rows: header detection, errors are reported not guessed, duplicates are caught", () => {
  const r = parseFinanceRows([
    ["Budget line", "Approved budget", "Actual expenditure", "Committed"],
    ["Staff", "6,000", "2,000", "500"],
    ["Supplies", "n/a", "100", ""],
    ["staff ", "1", "1", ""],
    ["", "1", "1", ""],
    ["Travel", "1000", "250", ""],
    ["", "", "", ""],
  ]);
  assert.equal(r.readyCount, 2);
  assert.equal(r.errorCount, 3);
  assert.deepEqual(r.rows.filter((x) => x.line).map((x) => x.line.budgetLine), ["Staff", "Travel"]);
  assert.match(r.rows.find((x) => x.rowIndex === 3).error, /Budget of "Supplies"/);
  assert.match(r.rows.find((x) => x.rowIndex === 4).error, /more than once/);
  assert.match(r.rows.find((x) => x.rowIndex === 5).error, /Missing budget line/);
});

test("spreadsheet rows: no header means line, budget, expenditure, committed; 'committed budget' is not the budget column", () => {
  const headerless = parseFinanceRows([["Staff", "100", "40", "10"]]);
  assert.deepEqual(headerless.rows[0].line, { budgetLine: "Staff", budget: "100", expenditure: "40", committed: "10" });
  const tricky = parseFinanceRows([["Category", "Committed budget", "Budget", "Spent"], ["Staff", "7", "100", "40"]]);
  assert.deepEqual(tricky.rows[0].line, { budgetLine: "Staff", budget: "100", expenditure: "40", committed: "7" });
});

test("the financial section is required and data-driven only when verified figures exist", () => {
  for (const reportType of ["QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]) {
    const off = blueprintSectionsFor({ reportType, scope: {} }).find((s) => s.id === `bp:${reportType.toLowerCase()}:finance`);
    const on = blueprintSectionsFor({ reportType, scope: {}, financeAvailable: true }).find((s) => s.id === `bp:${reportType.toLowerCase()}:finance`);
    assert.equal(off.required, false, reportType);
    assert.match(off.instructions, /reported separately/);
    assert.equal(on.required, true, reportType);
    assert.match(on.instructions, /table of them is added automatically/);
    assert.ok(!/overview|abstract/i.test(on.title));
  }
  assert.equal(blueprintSectionsFor({ reportType: "FINAL", scope: {}, financeAvailable: true }).find((s) => s.id === "bp:final:finance").title, "Financial Close-out");
});
