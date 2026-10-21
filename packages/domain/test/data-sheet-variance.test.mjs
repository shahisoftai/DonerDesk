import test from "node:test";
import assert from "node:assert/strict";
import { cellVariance, pivotSheet, CHART_MEASURES, PIVOT_MEASURE_LABEL } from "../dist/index.js";

const schedule = [{ asOf: "2026-03-31", target: "200" }, { asOf: "2026-06-30", target: "500" }];
const indicator = { id: "i1", code: "IND-1", name: "Wells", level: null, type: "NUMBER", baseline: "0", target: "1000", isRate: false, targetSchedule: schedule };
const periods = [
  { id: "p1", label: "Mar 2026", start: "2026-03-01", end: "2026-03-31", reportType: "MONTHLY", locked: false },
  { id: "p2", label: "Jun 2026", start: "2026-06-01", end: "2026-06-30", reportType: "MONTHLY", locked: false },
  { id: "p0", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false },
];
const cell = (periodId, periodValue, cumulativeValue) => ({ indicatorId: "i1", periodId, periodValue, cumulativeValue, status: "VERIFIED" });

test("variance uses the cumulative figure against the target scheduled for the period", () => {
  assert.equal(cellVariance(indicator, periods[0], cell("p1", "80", "220")), "+20 (+10%)");
  assert.equal(cellVariance(indicator, periods[1], cell("p2", "100", "400")), "-100 (-20%)");
});

test("no variance before the first scheduled date, without a schedule, for a rate, or with no value", () => {
  assert.equal(cellVariance(indicator, periods[2], cell("p0", "10", "10")), "");
  assert.equal(cellVariance({ ...indicator, targetSchedule: undefined }, periods[0], cell("p1", "80", "220")), "");
  assert.equal(cellVariance({ ...indicator, isRate: true }, periods[0], cell("p1", "80", "220")), "");
  assert.equal(cellVariance(indicator, periods[0], undefined), "");
  assert.equal(cellVariance(indicator, periods[0], cell("p1", "", "")), "");
});

test("the pivot offers the variance measure and charts do not", () => {
  const sheet = { projectId: "x", periods, indicators: [indicator], cells: [cell("p1", "80", "220")], finance: [], financeEnabled: false };
  const pivot = pivotSheet(sheet, "VARIANCE");
  assert.deepEqual(pivot.rows[0].slice(5), ["+20 (+10%)", "", ""]);
  assert.ok(PIVOT_MEASURE_LABEL.VARIANCE);
  assert.ok(!CHART_MEASURES.includes("VARIANCE"));
});
