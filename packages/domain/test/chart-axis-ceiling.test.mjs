import assert from "node:assert/strict";
import test from "node:test";
import { niceCeiling } from "../dist/index.js";

test("a stretched axis maximum is a tidy number, never a long decimal", () => {
  assert.equal(niceCeiling(114.55499999999999), 120);
  assert.equal(niceCeiling(105), 110);
  assert.equal(niceCeiling(52.5), 53);
  assert.equal(niceCeiling(5.25), 5.3);
  assert.equal(niceCeiling(1050), 1100);
});

test("a maximum that is already tidy is kept, and a non-positive one is left alone", () => {
  assert.equal(niceCeiling(100), 100);
  assert.equal(niceCeiling(0), 0);
  assert.equal(niceCeiling(-3), -3);
});
