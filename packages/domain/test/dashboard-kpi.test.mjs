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
