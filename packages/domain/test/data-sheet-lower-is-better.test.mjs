import assert from "node:assert/strict";
import test from "node:test";
import { cellPercentOfTarget, hasShareOfTarget } from "../dist/contexts/reporting/data-sheet.js";

const base = { id: "i1", code: "OP1-3", name: "Stock-out days", level: "OUTPUT", type: "NUMBER", baseline: "4", target: "2", isRate: false };
const cell = { indicatorId: "i1", periodId: "p1", periodValue: "2.5", cumulativeValue: "", status: "VERIFIED" };

test("a higher-is-better indicator has a share of target", () => {
  assert.equal(hasShareOfTarget(base), true);
  assert.equal(cellPercentOfTarget({ ...base, target: "5" }, cell), "50%");
});

test("an indicator where lower is better has no share of target (its target is a ceiling)", () => {
  const lower = { ...base, lowerIsBetter: true };
  assert.equal(hasShareOfTarget(lower), false);
  assert.equal(cellPercentOfTarget(lower, cell), "");
});

test("a rate still has no share of target", () => {
  assert.equal(hasShareOfTarget({ ...base, isRate: true }), false);
  assert.equal(cellPercentOfTarget({ ...base, isRate: true }, cell), "");
});

import { buildDataChart } from "../dist/index.js";

test("the progress chart leaves out an indicator where lower is better, and says so", () => {
  const sheet = {
    projectId: "p", financeEnabled: false, finance: [],
    periods: [{ id: "p1", label: "Dec 2026", start: "2026-12-01", end: "2026-12-31", reportType: "MONTHLY", locked: false }],
    indicators: [
      { id: "a", code: "OP1-1", name: "Trained", level: "OUTPUT", type: "NUMBER", unit: "people", baseline: "0", target: "100", isRate: false },
      { id: "b", code: "OP1-3", name: "Stock-out days", level: "OUTPUT", type: "NUMBER", unit: "days", baseline: "4", target: "2", isRate: false, lowerIsBetter: true },
    ],
    cells: [
      { indicatorId: "a", periodId: "p1", periodValue: "50", cumulativeValue: "50", status: "VERIFIED" },
      { indicatorId: "b", periodId: "p1", periodValue: "2.5", cumulativeValue: "", status: "VERIFIED" },
    ],
  };
  const r = buildDataChart(sheet, { template: "INDICATORS_PROGRESS", type: "BAR", measure: "PERCENT_OF_TARGET", indicatorIds: ["a", "b"], showTarget: false });
  assert.equal(r.ok, true);
  assert.deepEqual(r.option.xAxis.data, ["OP1-1"]);
  assert.match(r.notes.join(" "), /OP1-3/);
});
