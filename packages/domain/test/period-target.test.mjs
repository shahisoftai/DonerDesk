import test from "node:test";
import assert from "node:assert/strict";
import { withPeriodTarget } from "../dist/index.js";

const sum = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
const finding = (over = {}) => ({ indicatorId: "i", indicatorCode: "IND-1", status: "REPORTED", value: "80", cumulativeValue: "180", baseline: "0", target: "1000", semantics: sum, calculationMethod: "m", reportingPeriodId: "p", performanceEvaluation: { type: "NEGATIVE", detail: "x" }, ...over });
const schedule = [{ asOf: "2026-03-31", target: "200" }, { asOf: "2026-06-30", target: "500" }];

test("a period total of a SUM indicator is judged through its cumulative figure against the scheduled target", () => {
  const r = withPeriodTarget(finding(), schedule, "2026-03-31");
  assert.deepEqual(r.periodTarget, { target: "200", asOf: "2026-03-31" });
  assert.deepEqual(r.variance, { absolute: -20, percent: -10 });
  assert.equal(r.performanceEvaluation.type, "NEGATIVE");
  assert.equal(r.target, "1000"); // the project target is untouched
});

test("a finding on schedule is judged favourably even when far from the final target", () => {
  const r = withPeriodTarget(finding({ cumulativeValue: "210" }), schedule, "2026-03-31");
  assert.equal(r.performanceEvaluation.type, "POSITIVE");
  assert.deepEqual(r.variance, { absolute: 10, percent: 5 });
});

test("no cumulative figure for a SUM period: no variance and the evaluation is left as it was", () => {
  const r = withPeriodTarget(finding({ cumulativeValue: undefined }), schedule, "2026-03-31");
  assert.equal(r.variance, undefined);
  assert.equal(r.performanceEvaluation.type, "NEGATIVE");
  assert.ok(r.periodTarget);
});

test("a non-SUM indicator compares its own value", () => {
  const r = withPeriodTarget(finding({ value: "60", semantics: { ...sum, aggregation: "LATEST" } }), schedule, "2026-06-30");
  assert.deepEqual(r.variance, { absolute: -440, percent: -88 });
});

test("a figure that was not measured gets no variance", () => {
  const r = withPeriodTarget(finding({ status: "NOT_MEASURED", value: "0" }), schedule, "2026-03-31");
  assert.equal(r.variance, undefined);
});

test("no schedule, or a period before the first entry: unchanged", () => {
  const f = finding();
  assert.equal(withPeriodTarget(f, [], "2026-03-31"), f);
  assert.equal(withPeriodTarget(f, schedule, "2026-01-31"), f);
});
