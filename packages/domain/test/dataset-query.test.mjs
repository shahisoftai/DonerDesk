import assert from "node:assert/strict";
import test from "node:test";
import { resolveDataset, datasetGrid, groupByProject, buildDataChart } from "../dist/index.js";

const periods = ["Jan", "Feb", "Mar"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: id, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false, ...extra });
const cell = (indicatorId, periodId, periodValue, cumulativeValue, status = "VERIFIED") => ({ indicatorId, periodId, periodValue, cumulativeValue, status });
const sheet = {
  projectId: "x",
  periods,
  indicators: [ind("a"), ind("b", { unit: "kits" }), ind("r", { type: "PERCENTAGE", unit: "%", isRate: true })],
  cells: [cell("a", "p1", "10", "10"), cell("a", "p2", "20", "30", "DRAFT"), cell("b", "p1", "5", "5"), cell("r", "p1", "60", "60")],
  finance: [],
};
const q = (over = {}) => ({ indicatorIds: ["a"], measure: "PERIOD", includeDraft: true, ...over });
const value = (r, id, p) => r.points.find((x) => x.indicatorId === id && x.periodId === p).value;

test("one point per indicator and period; a period with nothing recorded is a gap, never 0", () => {
  const r = resolveDataset(sheet, q());
  assert.equal(r.points.length, 3);
  assert.equal(value(r, "a", "p1"), 10);
  assert.equal(value(r, "a", "p2"), 20);
  assert.equal(value(r, "a", "p3"), null);
  assert.deepEqual(datasetGrid(r)[0].values, [10, 20, null]);
});

test("drafts are plotted only when asked; otherwise they are withheld, counted and explained", () => {
  const off = resolveDataset(sheet, q({ includeDraft: false }));
  assert.equal(value(off, "a", "p2"), null);
  assert.equal(off.withheldDrafts, 1);
  assert.equal(off.provenance.unverified, 0);
  assert.equal(off.provenance.points, 1);
  assert.ok(off.notes.some((n) => /not verified yet/.test(n)));
  const on = resolveDataset(sheet, q());
  assert.equal(on.withheldDrafts, 0);
  assert.deepEqual(on.provenance, { points: 2, unverified: 1 });
  assert.equal(on.points.find((p) => p.periodId === "p2").verified, false);
});

test("the measure decides the figure: period, cumulative, or share of target", () => {
  assert.equal(value(resolveDataset(sheet, q({ measure: "CUMULATIVE" })), "a", "p2"), 30);
  assert.equal(value(resolveDataset(sheet, q({ measure: "PERCENT_OF_TARGET" })), "a", "p1"), 10);
});

test("a rate has no share of its target: a gap and a sentence, never a percentage of a percentage", () => {
  const r = resolveDataset(sheet, q({ indicatorIds: ["r"], measure: "PERCENT_OF_TARGET" }));
  assert.equal(value(r, "r", "p1"), null);
  assert.ok(r.notes.some((n) => /R/.test(n) && /% of target/.test(n)));
  assert.equal(value(resolveDataset(sheet, q({ indicatorIds: ["r"] })), "r", "p1"), 60);
});

test("the period range is inclusive, ends can be given either way round, and an unknown end is ignored", () => {
  assert.deepEqual(resolveDataset(sheet, q({ fromPeriodId: "p2", toPeriodId: "p3" })).periods.map((p) => p.id), ["p2", "p3"]);
  assert.deepEqual(resolveDataset(sheet, q({ fromPeriodId: "p3", toPeriodId: "p2" })).periods.map((p) => p.id), ["p2", "p3"]);
  assert.equal(resolveDataset(sheet, q({ fromPeriodId: "nope" })).periods.length, 3);
});

test("an indicator that is not in the sheet is listed, not drawn, and duplicates are asked once", () => {
  const r = resolveDataset(sheet, q({ indicatorIds: ["a", "a", "ghost"] }));
  assert.deepEqual(r.missingIndicatorIds, ["ghost"]);
  assert.equal(r.points.length, 3);
  assert.ok(r.notes.some((n) => /not in this project/.test(n)));
  assert.equal(resolveDataset(sheet, q({ indicatorIds: [] })).points.length, 0);
});

test("different units are flagged so no one puts them on one raw axis", () => {
  assert.equal(resolveDataset(sheet, q({ indicatorIds: ["a", "b"] })).mixedUnits, true);
  assert.equal(resolveDataset(sheet, q({ indicatorIds: ["a"] })).mixedUnits, false);
});

test("requests are grouped by project so each sheet is read once, in first-seen order", () => {
  const g = groupByProject([{ projectId: "p2", k: 1 }, { projectId: "p1", k: 2 }, { projectId: "p2", k: 3 }]);
  assert.deepEqual(g.map((x) => [x.projectId, x.requests.map((r) => r.k)]), [["p2", [1, 3]], ["p1", [2]]]);
  assert.deepEqual(groupByProject([]), []);
});

test("the dataset agrees with the chart builder on every plotted value", () => {
  const spec = { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", type: "BAR", showTarget: false };
  const drawn = buildDataChart(sheet, spec);
  const r = resolveDataset(sheet, q());
  assert.deepEqual(drawn.resolved.series[0].data, r.points.map((p) => p.value));
  assert.deepEqual(drawn.provenance, r.provenance);
});
