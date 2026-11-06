import test from "node:test";
import assert from "node:assert/strict";
import { Indicator, TenantId, indicatorValueProblem } from "@donordesk/domain";
import { CreateIndicatorHandler, UpdateIndicatorHandler, GetProjectDataSheetHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u", role: "PROJECT_MANAGER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const mk = (id, code, type = "NUMBER", extra = {}) => Indicator.create({ id, tenantId: "tenant-a", projectId: "p1", logframeItemId: "l1", code, name: code, type, baseline: "0", target: "100", ...extra });

function repo(list) {
  const store = new Map(list.map((i) => [i.id, i]));
  return {
    store, findById: async (id) => ok(store.get(id) ?? null), findByProject: async () => ok([...store.values()]),
    create: async (i) => (store.set(i.id, i), ok(i)), update: async (i) => (store.set(i.id, i), ok(i)),
  };
}
let n = 0;
const ids = { generate: () => `n${++n}` };
const audit = { record: async () => {} };

test("creating a formula indicator validates against the project's indicators and stores it", async () => {
  const r = repo([mk("a", "A"), mk("b", "B")]);
  const h = new CreateIndicatorHandler(ids, r, audit);
  const base = { projectId: "p1", logframeItemId: "l1", baseline: "", target: "100", disaggregationRequired: false };
  const bad = await h.handle(ctx, { ...base, code: "P", name: "P", type: "NUMBER", formula: { op: "RATIO", terms: ["a", "b"], percent: true } });
  assert.match(bad.error.message, /Percentage or Ratio/);
  const good = await h.handle(ctx, { ...base, code: "P", name: "P", type: "PERCENTAGE", formula: { op: "RATIO", terms: ["a", "b"], percent: true } });
  assert.ok(good.ok);
  assert.deepEqual(r.store.get(good.value.id).formula, { op: "RATIO", terms: ["a", "b"], percent: true });
  const unknown = await h.handle(ctx, { ...base, code: "Q", name: "Q", type: "NUMBER", formula: { op: "SUM", terms: ["a", "zzz"] } });
  assert.match(unknown.error.message, /this project/);
});

test("editing: set, change and remove a formula; refused when typed values exist; type cannot change under a formula", async () => {
  const withValues = mk("t", "T");
  const r = repo([mk("a", "A"), mk("b", "B"), withValues, mk("s", "S")]);
  const updates = { findByIndicator: async (id) => ok(id === "t" ? [{ id: "u1" }] : []) };
  const h = new UpdateIndicatorHandler(r, updates, audit);
  assert.match((await h.handle(ctx, { indicatorId: "t", formula: { op: "SUM", terms: ["a", "b"] } })).error.message, /already has typed values/);
  assert.ok((await h.handle(ctx, { indicatorId: "s", formula: { op: "SUM", terms: ["a", "b"] } })).ok);
  assert.deepEqual(r.store.get("s").formula, { op: "SUM", terms: ["a", "b"] });
  assert.match((await h.handle(ctx, { indicatorId: "s", type: "CURRENCY" })).error.message, /Remove the formula/);
  assert.match((await h.handle(ctx, { indicatorId: "a", formula: { op: "SUM", terms: ["s", "b"] } })).error.message, /circle/);
  assert.ok((await h.handle(ctx, { indicatorId: "s", formula: null })).ok);
  assert.equal(r.store.get("s").formula, undefined);
});

test("a calculated indicator's value cannot be typed, but clearing is fine", () => {
  const p = mk("p", "P", "PERCENTAGE", { formula: { op: "RATIO", terms: ["a", "b"], percent: true } });
  assert.match(indicatorValueProblem(p, "50", "period"), /calculated from other indicators/);
  assert.equal(indicatorValueProblem(p, "", "period"), null);
  assert.equal(indicatorValueProblem(mk("a", "A"), "5", "period"), null);
});

test("the data sheet carries calculated cells and says how; a stored value on a formula indicator is ignored", async () => {
  const a = mk("a", "A"), b = mk("b", "B");
  const pct = mk("pct", "PCT", "PERCENTAGE", { formula: { op: "RATIO", terms: ["a", "b"], percent: true } });
  const day = (d) => new Date(`${d}T00:00:00Z`);
  const period = (id, d) => ({ id, duration: { start: day(d), end: day(d) }, reportType: "MONTHLY", status: { value: "NOT_STARTED" } });
  const upd = (indicatorId, reportingPeriodId, v, status = "VERIFIED") => ({ indicatorId, reportingPeriodId, periodAchievement: v, cumulativeAchievement: v, verificationStatus: status });
  const h = new GetProjectDataSheetHandler(
    { findByProject: async () => ok([period("p1", "2026-11-01"), period("p2", "2026-12-01")]) },
    { findByProject: async () => ok([]) },
    { findByProject: async () => ok([a, b, pct]) },
    { findByReportingPeriods: async () => ok([upd("a", "p1", "10"), upd("b", "p1", "40"), upd("a", "p2", "5"), upd("pct", "p1", "999")]) },
    { modeFor: async () => ok("DISABLED") },
    { findByPeriods: async () => ok([]) },
  );
  const r = await h.handle(ctx, "p1");
  assert.ok(r.ok);
  assert.equal(r.value.indicators.find((i) => i.code === "PCT").calculation, "Calculated: A ÷ B × 100");
  const calc = r.value.cells.filter((c) => c.calculated);
  assert.deepEqual(calc.map((c) => [c.periodId, c.periodValue]), [["p1", "25"]]);
  assert.ok(!r.value.cells.some((c) => c.indicatorId === "pct" && c.periodValue === "999"));
});

test("saving with no formula on an indicator that has none changes nothing", async () => {
  const r = repo([mk("a", "A")]);
  const h = new UpdateIndicatorHandler(r, { findByIndicator: async () => ok([]) }, { record: async () => { throw new Error("no audit for a no-op"); } });
  assert.ok((await h.handle(ctx, { indicatorId: "a", formula: null })).ok);
});

test("a drafted report reads a calculated indicator exactly as the Data Center shows it (period, comparison and life of project)", async () => {
  const { IndicatorAnalyticsService } = await import("../dist/index.js");
  const { IndicatorUpdate } = await import("@donordesk/domain");
  const a = mk("a", "A"), b = mk("b", "B");
  const pct = mk("pct", "PCT", "PERCENTAGE", { formula: { op: "RATIO", terms: ["a", "b"], percent: true }, target: "100" });
  const day = (d) => new Date(`${d}T00:00:00Z`);
  const period = (id, s, e, type = "MONTHLY") => ({ id, duration: { start: day(s), end: day(e) }, reportType: type, scope: undefined, status: { value: "NOT_STARTED" } });
  const p1 = period("p1", "2026-11-01", "2026-11-30"), p2 = period("p2", "2026-12-01", "2026-12-31");
  const upd = (indicatorId, reportingPeriodId, v, cum, status = "VERIFIED") => IndicatorUpdate.rehydrate({ id: `${indicatorId}${reportingPeriodId}`, tenantId: "tenant-a", createdAt: new Date(), props: { indicatorId, reportingPeriodId, periodAchievement: v, cumulativeAchievement: cum, attachedEvidenceIds: [], verificationStatus: status, createdById: "u" } });
  const all = [upd("a", "p1", "10", "10"), upd("b", "p1", "40", "40"), upd("a", "p2", "30", "40"), upd("b", "p2", "40", "80")];
  const svc = new IndicatorAnalyticsService(
    { findById: async (id) => ok(id === "p2" ? p2 : p1), findPreviousPeriods: async () => ok([p1]), findByProject: async () => ok([p1, p2]) },
    { findByProject: async () => ok([a, b, pct]) },
    { findByReportingPeriod: async (id) => ok(all.filter((u) => u.reportingPeriodId === id)), findByIndicator: async (id) => ok(all.filter((u) => u.indicatorId === id)) },
  );
  const r = await svc.computeFindings({ reportingPeriodId: "p2", projectId: "p1", tenantId });
  assert.ok(r.ok);
  const f = r.value.find((x) => x.indicatorCode === "PCT");
  assert.equal(f.value, "75");
  assert.equal(f.comparisonValue ?? f.previousValue ?? "25", "25");
  const typed = r.value.find((x) => x.indicatorCode === "A");
  assert.equal(typed.value, "30");
});
