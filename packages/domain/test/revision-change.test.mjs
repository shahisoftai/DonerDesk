import test from "node:test";
import assert from "node:assert/strict";
import { summariseRevisionChange, describeRevisionChange, figuresIn } from "../dist/index.js";

test("figures are read as written, without separators, dates or list numbers", () => {
  assert.deepEqual(figuresIn("We reached 1,200 people (45%) on 2026-03-31; 3.5 km of pipe.\n1. First"), ["1200", "45%", "3.5"]);
});

test("a change lists the words and the figures that came and went", () => {
  const c = summariseRevisionChange("We drilled 40 wells and reached 1,200 people.", "We drilled 42 wells and reached 1200 people, a good result.");
  assert.deepEqual(c.figuresAdded, ["42"]);
  assert.deepEqual(c.figuresRemoved, ["40"]);
  assert.equal(c.wordsBefore, 8);
  assert.equal(c.wordsAfter, 11);
  assert.equal(describeRevisionChange(c), "8 → 11 words (+3); figures added: 42; figures removed: 40");
});

test("text that differs only in markup is unchanged", () => {
  const c = summariseRevisionChange("Wells **drilled**: 12", "Wells drilled: 12");
  assert.equal(c.unchanged, true);
  assert.match(describeRevisionChange(c), /same as the version before/);
});

test("a wording change with no figure change says so, and a long list is shortened", () => {
  assert.match(describeRevisionChange(summariseRevisionChange("Good work.", "Very good work indeed.")), /no figure changed/);
  const many = summariseRevisionChange("x", "1 2 3 4 5 6 7");
  assert.match(describeRevisionChange(many), /figures added: 1, 2, 3, 4 and 3 more/);
});
