import test from "node:test";
import assert from "node:assert/strict";
import { buildKpi, restrictWidgetToPeriod, widgetProblems } from "../dist/index.js";

const periods = ["Jan", "Feb", "Mar"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: `${id} reached`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false, ...extra });
const cell = (indicatorId, periodId, periodValue, cumulativeValue, status = "VERIFIED") => ({ indicatorId, periodId, periodValue, cumulativeValue, status });
const sheet = { projectId: "x", periods, indicators: [ind("a"), ind("r", { type: "PERCENTAGE", unit: "%", isRate: true })],
  cells: [cell("a", "p1", "10", "10"), cell("a", "p2", "20", "30", "DRAFT"), cell("r", "p1", "60", "60")], finance: [] };

test("a KPI shows the latest period with a figure, its share of target and a sparkline with a gap for the empty period", () => {
  const r = buildKpi(sheet, { indicatorId: "a", includeDraft: true });
  assert.ok(r.ok);
  assert.equal(r.tile.value, 20);
  assert.equal(r.tile.periodLabel, "Feb");
  assert.equal(r.tile.percentOfTarget, 30);
  assert.equal(r.tile.unverified, true);
  assert.deepEqual(r.tile.spark.map((s) => s.value), [10, 20, null]);
});
test("without drafts the tile falls back to the latest verified figure", () => {
  const r = buildKpi(sheet, { indicatorId: "a", includeDraft: false });
  assert.equal(r.tile.value, 10);
  assert.equal(r.tile.unverified, false);
});
test("a rate has no share of target, an unknown indicator is refused, and nothing recorded is null not 0", () => {
  assert.equal(buildKpi(sheet, { indicatorId: "r", includeDraft: true }).tile.percentOfTarget, null);
  assert.equal(buildKpi(sheet, { indicatorId: "zzz", includeDraft: true }).ok, false);
  const empty = buildKpi({ ...sheet, cells: [] }, { indicatorId: "a", includeDraft: true });
  assert.equal(empty.tile.value, null);
  assert.equal(empty.tile.periodLabel, null);
});
test("the viewer's period filter ends a KPI at that period; a KPI widget needs an indicator", () => {
  const w = { id: "k", projectId: "x", kind: "KPI", kpi: { indicatorId: "a", includeDraft: true }, x: 0, y: 0, w: 4, h: 2 };
  const narrowed = restrictWidgetToPeriod(w, "p1", ["p1", "p2"]);
  assert.equal(buildKpi(sheet, narrowed.kpi).tile.value, 10);
  assert.equal(widgetProblems([w]).length, 0);
  assert.equal(widgetProblems([{ ...w, kpi: undefined }]).length, 1);
});

import { kpiChange, kpiStatusOf, KPI_STATUSES, KPI_STATUS_RULES } from "../dist/index.js";

test("a KPI compares the latest figure with the earlier one, and says whether that direction is the wanted one", () => {
  const r = buildKpi(sheet, { indicatorId: "a", includeDraft: true });
  assert.deepEqual(r.tile.change, { direction: "UP", delta: 10, percent: 100, sincePeriod: "Jan", good: true });
  assert.equal(buildKpi(sheet, { indicatorId: "a", includeDraft: false }).tile.change, null);
});
test("a lower-is-better indicator that fell is good; no change is neither; a zero start has no percent", () => {
  assert.equal(kpiChange({ value: 5 }, { value: 8, periodLabel: "x" }, true).good, true);
  assert.equal(kpiChange({ value: 5 }, { value: 5, periodLabel: "x" }, false).good, null);
  assert.equal(kpiChange({ value: 5 }, { value: 0, periodLabel: "x" }, false).percent, null);
  assert.equal(kpiChange({ value: 5 }, null, false), null);
});
test("status: nothing recorded, not judged (rate or no target), target met, in progress; every status has a rule", () => {
  assert.equal(kpiStatusOf({ value: null, percentOfTarget: null }), "NO_DATA");
  assert.equal(kpiStatusOf({ value: 60, percentOfTarget: null }), "NOT_JUDGED");
  assert.equal(kpiStatusOf({ value: 100, percentOfTarget: 100 }), "TARGET_MET");
  assert.equal(kpiStatusOf({ value: 20, percentOfTarget: 30 }), "IN_PROGRESS");
  assert.deepEqual(KPI_STATUS_RULES.map((r) => r.status).sort(), [...KPI_STATUSES].sort());
  assert.equal(buildKpi(sheet, { indicatorId: "r", includeDraft: true }).tile.status, "NOT_JUDGED");
});
