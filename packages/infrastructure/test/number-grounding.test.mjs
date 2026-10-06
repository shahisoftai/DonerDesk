import assert from "node:assert/strict";
import test from "node:test";
import { allowedNumbers, ungroundedNumbers } from "../dist/ai/number-grounding.js";

// Mirror of test_percent_of_target_of_a_recorded_cumulative_value_is_grounded in apps/workers/tests/test_ai_reporter_cumulative.py.
const findings = [{ indicatorCode: "OUT-1", value: "2,500", target: "8,000", baseline: "0" }];
const sources = {
  verifiedFindings: findings,
  indicatorUpdates: [
    { indicatorCode: "OUT-1", periodAchievement: "2,500", cumulativeAchievement: "7,000" },
    { indicatorCode: "UNKNOWN", cumulativeAchievement: "9,999" },
  ],
};

test("the percent of target of a recorded cumulative value is grounded (D5-2), mirroring the worker", () => {
  const allowed = allowedNumbers(sources, findings);
  assert.deepEqual(ungroundedNumbers("Cumulative 7,000, which is 87.5% of the target.", allowed), []);
  assert.deepEqual(ungroundedNumbers("Cumulative 7,000, which is 91% of the target.", allowed), ["91"]);
});

test("a not-calculable indicator grounds no derived percent from its updates", () => {
  const notCalculable = [{ indicatorCode: "OUT-1", value: null, target: "8,000", valueStatus: "NOT_CALCULABLE" }];
  const allowed = allowedNumbers({ indicatorUpdates: sources.indicatorUpdates }, notCalculable);
  assert.deepEqual(ungroundedNumbers("That is 87.5% of the target.", allowed), ["87.5"]);
});
