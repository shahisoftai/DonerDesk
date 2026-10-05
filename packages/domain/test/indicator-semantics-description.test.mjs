import test from "node:test";
import assert from "node:assert/strict";
import { describeSemantics, effectiveIndicatorSemantics, inferIndicatorSemantics, INDICATOR_TYPES } from "../dist/index.js";

test("an unrecognised count needs review and is described as summed", () => {
  const eff = effectiveIndicatorSemantics({ type: "NUMBER", name: "Widgets" });
  const d = describeSemantics(eff, "NUMBER");
  assert.equal(d.summary, "Counts: summed across periods. Not evaluated against the target. Needs review.");
});

test("a recognisably summable count is inferred, not flagged", () => {
  const d = describeSemantics(effectiveIndicatorSemantics({ type: "NUMBER", name: "Children enrolled" }), "NUMBER");
  assert.equal(d.needsReview, false);
});

test("a rate without numerator/denominator is a latest reported value that needs review", () => {
  const eff = effectiveIndicatorSemantics({ type: "PERCENTAGE", name: "Attendance rate" });
  const d = describeSemantics(eff, "PERCENTAGE");
  assert.equal(eff.aggregation, "LATEST");
  assert.equal(d.needsReview, true);
  assert.match(d.summary, /^Rate: latest reported value\./);
});

test("configured semantics do not need review and have no reasons", () => {
  const d = describeSemantics({ aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" }, "NUMBER");
  assert.equal(d.needsReview, false);
  assert.deepEqual(d.reasons, []);
  assert.equal(d.evaluationLabel, "Higher is better");
});

test("description agrees with inference for every indicator type", () => {
  for (const type of INDICATOR_TYPES) {
    const inferred = inferIndicatorSemantics({ type, name: "x" });
    const eff = effectiveIndicatorSemantics({ type, name: "x" });
    assert.deepEqual(eff, inferred);
    assert.equal(describeSemantics(eff, type).needsReview, inferred.status === "REQUIRES_REVIEW");
  }
});

test("stored semantics win over inference", () => {
  const stored = { aggregation: "MAX", direction: "LOWER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
  assert.deepEqual(effectiveIndicatorSemantics({ type: "NUMBER", name: "x", semantics: stored }), stored);
});
