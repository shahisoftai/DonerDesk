import test from "node:test";
import assert from "node:assert/strict";
import { kpiNarrative, NARRATIVE_RULES } from "../dist/index.js";

const f = (o = {}) => ({ value: 20, status: "IN_PROGRESS", percentOfTarget: 30.4, periodLabel: "Feb", target: "100", ...o });

test("a figure part-way to its target gets one sentence with its share, period and target", () => {
  assert.deepEqual(kpiNarrative(f()), { key: "narrative.inProgress", params: { percent: 30, period: "Feb", target: "100" } });
});
test("a target reached says so", () => {
  assert.equal(kpiNarrative(f({ status: "TARGET_MET", percentOfTarget: 104 })).key, "narrative.targetMet");
});
test("nothing honest to say gives no sentence: no figure, a rate or unfair comparison, no target", () => {
  assert.equal(kpiNarrative(f({ value: null })), null);
  assert.equal(kpiNarrative(f({ status: "NOT_JUDGED", percentOfTarget: null })), null);
  assert.equal(kpiNarrative(f({ target: null })), null);
  assert.equal(kpiNarrative(f({ periodLabel: null })), null);
});
test("the last rule always applies, so every judged tile is covered", () => {
  assert.equal(NARRATIVE_RULES[NARRATIVE_RULES.length - 1].when({}), true);
});
