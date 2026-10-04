import test from "node:test";
import assert from "node:assert/strict";
import {
  FinanceInputsService, GetPeriodFinanceHandler, SavePeriodFinanceHandler, PreviewPeriodFinanceImportHandler, VerifyPeriodFinanceHandler,
  deterministicBlueprintTable, financeItems,
} from "../dist/index.js";
import { ReportingPeriod, ReportingProfile, PeriodFinancialSummary, TenantId, summarizeFinance, normalizeFinanceFigures } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };

const period = (reportType = "QUARTERLY") =>
  ReportingPeriod.create({ id: "p1", tenantId: "tenant-a", projectId: "proj", reportType, startDate: new Date("2028-01-01"), endDate: new Date("2028-03-31"), deadline: new Date("2028-04-30") });

function world({ mode = "TYPED", reportType = "QUARTERLY", stored = null, drafts = [] } = {}) {
  const profile = mode === null ? null : ReportingProfile.create({ id: "pr", tenantId: "tenant-a", projectId: "proj", financeDataMode: mode, createdById: "u" });
  const state = { stored, audits: [] };
  const summaries = {
    findByPeriod: async () => ({ ok: true, value: state.stored }),
    save: async (s) => ((state.stored = s), { ok: true, value: s }),
  };
  const periods = { findById: async (id) => ({ ok: true, value: id === "p1" ? period(reportType) : null }) };
  const projects = { findById: async () => ({ ok: true, value: { budget: { amount: 1, currency: "EUR" } } }) };
  const finance = new FinanceInputsService({ findByProject: async () => ({ ok: true, value: profile }) }, summaries);
  const audit = { record: async (e) => state.audits.push(e) };
  let n = 0;
  return {
    state, finance, summaries,
    get: new GetPeriodFinanceHandler(periods, finance, projects, summaries),
    save: new SavePeriodFinanceHandler({ generate: () => `f${++n}` }, periods, finance, projects, summaries, { findByReportingPeriod: async () => ({ ok: true, value: drafts }) }, audit),
    preview: new PreviewPeriodFinanceImportHandler(periods, finance, projects),
    verify: new VerifyPeriodFinanceHandler(periods, finance, projects, summaries, audit),
  };
}

const stored = (verified) => {
  const s = PeriodFinancialSummary.create({ id: "f", tenantId: "tenant-a", projectId: "proj", reportingPeriodId: "p1", currency: "USD", source: "TYPED", figures: { budget: "1000", expenditure: "250" }, createdById: "u" });
  if (verified) s.verify("u2");
  return s;
};

test("only verified figures reach the writers, and only when finance applies", async () => {
  const w = world({ stored: stored(true) });
  const v = await w.finance.verifiedFor(period(), tenantId);
  assert.equal(v.value.burnRatePercent, "25");
  assert.equal(v.value.balance, "750");
  assert.equal((await world({ stored: stored(false) }).finance.verifiedFor(period(), tenantId)).value, undefined, "unverified figures are never sent");
  assert.equal((await world({ mode: "DISABLED", stored: stored(true) }).finance.verifiedFor(period(), tenantId)).value, undefined);
  assert.equal((await world({ stored: stored(true) }).finance.verifiedFor(period("MONTHLY"), tenantId)).value, undefined, "a monthly report has no financial section");
  assert.equal((await world({ mode: null, stored: stored(true) }).finance.verifiedFor(period(), tenantId)).value, undefined, "no profile means finance is off");
});

test("finance status for the checklist", async () => {
  const status = async (opts) => (await world(opts).finance.statusFor(period(opts?.reportType), tenantId)).value;
  assert.equal(await status({ mode: "DISABLED" }), "OFF");
  assert.equal(await status({}), "MISSING");
  assert.equal(await status({ stored: stored(false) }), "UNVERIFIED");
  assert.equal(await status({ stored: stored(true) }), "VERIFIED");
  assert.equal(await status({ reportType: "ACTIVITY" }), "OFF");
  assert.deepEqual(financeItems("OFF"), []);
  assert.deepEqual(financeItems("VERIFIED"), []);
  assert.deepEqual(financeItems("MISSING").map((i) => [i.type, i.relatedEntityId]), [["FINANCE_FIGURES_PROVIDED", "entry"]]);
  assert.deepEqual(financeItems("UNVERIFIED").map((i) => [i.type, i.relatedEntityId, i.severity]), [["FINANCE_FIGURES_PROVIDED", "verification", "HIGH"]]);
});

test("saving figures: the project's mode sets the source, the new summary starts unverified, and it is audited", async () => {
  const w = world({ mode: "IMPORT" });
  const r = await w.save.handle(ctx, "p1", { lines: [{ budgetLine: "Staff", budget: "6,000", expenditure: "2,000" }] });
  assert.equal(r.ok, true);
  assert.equal(r.value.summary.source, "IMPORT");
  assert.equal(r.value.summary.verified, false);
  assert.equal(r.value.summary.view.currency, "EUR", "defaults to the project's budget currency");
  assert.equal(r.value.summary.figures.budget, "6000");
  assert.equal(w.state.audits[0].eventType, "reporting_period.finance_saved");
});

test("editing verified figures drops the verification", async () => {
  const w = world({ stored: stored(true) });
  const r = await w.save.handle(ctx, "p1", { budget: "1000", expenditure: "300" });
  assert.equal(r.value.summary.verified, false);
  assert.equal(r.value.summary.view.burnRatePercent, "30");
});

test("saving is refused when finance is off, for a report without a financial section, while frozen, or for bad amounts", async () => {
  assert.equal((await world({ mode: "DISABLED" }).save.handle(ctx, "p1", { budget: "1", expenditure: "1" })).error.code, "POLICY_DENIED");
  assert.equal((await world({ reportType: "MONTHLY" }).save.handle(ctx, "p1", { budget: "1", expenditure: "1" })).error.code, "VALIDATION_FAILED");
  assert.equal((await world({ drafts: [{ status: "APPROVED" }] }).save.handle(ctx, "p1", { budget: "1", expenditure: "1" })).error.code, "INVALID_STATE_TRANSITION");
  const bad = await world().save.handle(ctx, "p1", { budget: "lots", expenditure: "1" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, "VALIDATION_FAILED");
  assert.equal((await world().save.handle(ctx, "missing", { budget: "1", expenditure: "1" })).error.code, "NOT_FOUND");
});

test("import preview needs import mode and stores nothing", async () => {
  const rows = [["Budget line", "Budget", "Expenditure"], ["Staff", "100", "40"], ["Bad", "x", "1"]];
  const w = world({ mode: "IMPORT" });
  const r = await w.preview.handle(ctx, "p1", rows);
  assert.deepEqual([r.value.readyCount, r.value.errorCount], [1, 1]);
  assert.equal(w.state.stored, null);
  assert.equal((await world({ mode: "TYPED" }).preview.handle(ctx, "p1", rows)).error.code, "POLICY_DENIED");
});

test("verifying: needs stored figures, works once, is audited, and is refused when finance is off", async () => {
  const w = world({ stored: stored(false) });
  const r = await w.verify.handle(ctx, "p1");
  assert.equal(r.value.summary.verified, true);
  assert.equal(r.value.summary.verifiedById, "u1");
  assert.equal(w.state.audits.at(-1).eventType, "reporting_period.finance_verified");
  assert.equal((await w.verify.handle(ctx, "p1")).error.code, "INVALID_STATE_TRANSITION");
  assert.equal((await world().verify.handle(ctx, "p1")).error.code, "NOT_FOUND");
  assert.equal((await world({ mode: "DISABLED", stored: stored(false) }).verify.handle(ctx, "p1")).error.code, "POLICY_DENIED");
});

test("reading: DISABLED shows no summary even if one was stored earlier; data is kept", async () => {
  const w = world({ mode: "DISABLED", stored: stored(true) });
  const r = await w.get.handle(ctx, "p1");
  assert.equal(r.value.mode, "DISABLED");
  assert.equal(r.value.summary, null);
  assert.ok(w.state.stored, "switching off never deletes stored figures");
  const on = await world({ stored: stored(true) }).get.handle(ctx, "p1");
  assert.equal(on.value.summary.verified, true);
  assert.equal(on.value.appliesToReportType, true);
  assert.equal(on.value.defaultCurrency, "EUR");
});

test("the financial table: one row per line then the total, with computed balance and burn rate", () => {
  const view = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Staff | core", budget: "6000", expenditure: "1500", committed: "500" }, { budgetLine: "Supplies", budget: "4000", expenditure: "0" }] }));
  const md = deterministicBlueprintTable("bp:quarterly:finance", [], undefined, undefined, view).split("\n");
  assert.equal(md[0], "| Budget line | Budget (USD) | Expenditure (USD) | Committed (USD) | Balance (USD) | Burn rate |");
  assert.equal(md[2], "| Staff \\| core | 6000 | 1500 | 500 | 4500 | 25% |");
  assert.equal(md[3], "| Supplies | 4000 | 0 | — | 4000 | 0% |");
  assert.equal(md[4], "| **Total** | 10000 | 1500 | 500 | 8500 | 15% |");
  const noLines = summarizeFinance("USD", normalizeFinanceFigures({ budget: "100", expenditure: "40" }));
  const md2 = deterministicBlueprintTable("bp:final:finance", [], "fr", undefined, noLines).split("\n");
  assert.equal(md2[0], "| Ligne budgétaire | Budget (USD) | Dépenses (USD) | Solde (USD) | Taux de consommation |");
  assert.equal(md2[2], "| **Total** | 100 | 40 | 60 | 40% |");
  assert.equal(deterministicBlueprintTable("bp:quarterly:finance", [], undefined, undefined, undefined), undefined);
  assert.equal(deterministicBlueprintTable("bp:quarterly:results", [], undefined, undefined, view), undefined);
});

test("verifiedForPeriod grounds already-written numbers: verified figures only, and only while finance is on", async () => {
  const check = async (opts) => (await world(opts).finance.verifiedForPeriod("p1", "proj", tenantId)).value;
  assert.equal((await check({ stored: stored(true) })).expenditure, "250");
  assert.equal(await check({ stored: stored(false) }), undefined);
  assert.equal(await check({ mode: "DISABLED", stored: stored(true) }), undefined);
  assert.equal(await check({ mode: null, stored: stored(true) }), undefined);
  assert.equal(await check({}), undefined);
});

import { isDonorFinanceSection, financeTable } from "../dist/index.js";

test("a donor template's financial narrative is recognised; annexes, tables and other sections are not", () => {
  const yes = ["Financial Status", "3. Financial Report", "Financial Summary", "Finance", "Budget Utilisation", "Expenditure", "Financial and Procurement Status"];
  for (const title of yes) assert.equal(isDonorFinanceSection({ title }), true, title);
  for (const title of ["Annex C: Financial Statements", "Lessons Learned", "Activities", "Budget justification for the next phase"]) assert.equal(isDonorFinanceSection({ title }), false, title);
  assert.equal(isDonorFinanceSection({ title: "Financial Report", inputType: "TABLE" }), false);
  assert.equal(isDonorFinanceSection({ title: "Financial Report", requiredTables: [{ title: "Budget", columns: ["a"] }] }), false, "the donor's own table shape wins");
  assert.equal(isDonorFinanceSection({ title: "Rapport financier", canonicalTitle: "Financial Report" }), true, "the English title decides in translated reports");
  const view = summarizeFinance("USD", normalizeFinanceFigures({ budget: "100", expenditure: "40" }));
  assert.match(financeTable(view), /\| \*\*Total\*\* \| 100 \| 40 \| 60 \| 40% \|/);
});
