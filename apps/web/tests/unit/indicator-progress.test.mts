import assert from "node:assert/strict";
import test from "node:test";
import { computeIndicatorProgress, parseIndicatorNumber } from "../../src/features/logframe/domain/indicator-progress.ts";

test("parses formatted numbers and rejects text", () => {
  assert.equal(parseIndicatorNumber("1,250"), 1250);
  assert.equal(parseIndicatorNumber("45%"), 45);
  assert.equal(parseIndicatorNumber("n/a"), null);
  assert.equal(parseIndicatorNumber(""), null);
});

test("increasing target", () => {
  const p = computeIndicatorProgress("0", "200", "50");
  assert.equal(p?.fraction, 0.25);
});

test("decreasing target (lower is better)", () => {
  const p = computeIndicatorProgress("40", "10", "25");
  assert.equal(p?.fraction, 0.5);
});

test("over-achievement and regression stay visible in rawFraction", () => {
  assert.equal(computeIndicatorProgress("0", "100", "150")?.rawFraction, 1.5);
  assert.equal(computeIndicatorProgress("0", "100", "150")?.fraction, 1);
  assert.equal(computeIndicatorProgress("10", "100", "5")?.fraction, 0);
});

test("not computable when target missing or equals baseline", () => {
  assert.equal(computeIndicatorProgress("0", "", "5"), null);
  assert.equal(computeIndicatorProgress("5", "5", "5"), null);
  assert.equal(computeIndicatorProgress("", "100", "40")?.fraction, 0.4);
});
