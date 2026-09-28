import { test } from "node:test";
import assert from "node:assert/strict";
import { simulatedPercent } from "../../src/components/feedback/ai-activity-progress.ts";

test("simulatedPercent: starts at 0, keeps climbing, never claims done", () => {
  assert.equal(simulatedPercent(0, 100_000), 0);
  const at10s = simulatedPercent(10_000, 100_000);
  const at60s = simulatedPercent(60_000, 100_000);
  const at10min = simulatedPercent(600_000, 100_000);
  assert.ok(at10s > 0 && at10s < at60s, "keeps climbing over time");
  assert.ok(at60s < at10min, "still climbing well past the estimate");
  assert.ok(at10min < 92, "never reaches 100% on its own — the caller closes the popup on real completion");
  assert.ok(at10min > 85, "gets close to the cap given enough time");
});

test("simulatedPercent: a shorter estimate climbs faster for the same elapsed time", () => {
  const fast = simulatedPercent(20_000, 50_000);
  const slow = simulatedPercent(20_000, 200_000);
  assert.ok(fast > slow);
});
