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
