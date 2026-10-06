import assert from "node:assert/strict";
import test from "node:test";
import { countOf, agree, stillNeed } from "../dist/index.js";

test("counts and the words that agree with them", () => {
  assert.equal(countOf(1, "item"), "1 item");
  assert.equal(countOf(0, "item"), "0 items");
  assert.equal(countOf(2, "person", "people"), "2 people");
  assert.equal(agree(1, "needs", "need"), "needs");
  assert.equal(agree(3, "needs", "need"), "need");
  assert.equal(agree(0, "needs", "need"), "need");
});

test("stillNeed never says '1 item still need attention'", () => {
  assert.equal(stillNeed(1, "item"), "1 item still needs attention");
  assert.equal(stillNeed(4, "item"), "4 items still need attention");
  assert.equal(stillNeed(1, "statement", undefined, "your attention"), "1 statement still needs your attention");
  assert.equal(stillNeed(0, "item"), "0 items still need attention");
});
