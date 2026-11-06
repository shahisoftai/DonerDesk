import assert from "node:assert/strict";
import test from "node:test";
import { isLowData, parseLowDataChoice } from "../../src/features/design/domain/low-data.ts";

test("a person's choice wins over the browser's request; with none, the browser decides", () => {
  assert.equal(isLowData("on", false), true);
  assert.equal(isLowData("off", true), false);
  assert.equal(isLowData(null, true), true);
  assert.equal(isLowData(null, false), false);
});
test("only 'on' and 'off' are read from storage", () => {
  assert.equal(parseLowDataChoice("on"), "on");
  assert.equal(parseLowDataChoice("yes"), null);
  assert.equal(parseLowDataChoice(undefined), null);
});
