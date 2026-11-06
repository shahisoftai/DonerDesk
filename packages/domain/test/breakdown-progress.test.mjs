import test from "node:test";
import assert from "node:assert/strict";
import { breakdownProgress } from "../dist/index.js";

const e = (category, value, dimension = "SEX") => ({ dimension, category, value });
const targets = [e("Women", "150"), e("Men", "100")];

test("a count adds a group across verified periods and shows how far along it is", () => {
  const rows = breakdownProgress({
    type: "NUMBER", targets,
    updates: [
      { periodEnd: "2026-03-31", verified: true, entries: [e("Women", "40"), e("Men", "20")] },
      { periodEnd: "2026-06-30", verified: true, entries: [e("women", "35")] },
    ],
  });
  assert.deepEqual(rows[0], { dimension: "SEX", category: "Women", target: 150, actual: 75, percentOfTarget: 50, periods: 2 });
  assert.deepEqual([rows[1].actual, rows[1].periods], [20, 1], "Men was reported once");
});

test("only verified values count; a group nobody reported is blank, never zero", () => {
  const rows = breakdownProgress({ type: "NUMBER", targets, updates: [{ periodEnd: "2026-03-31", verified: false, entries: [e("Women", "999")] }] });
  assert.deepEqual(rows.map((r) => [r.actual, r.percentOfTarget, r.periods]), [[null, null, 0], [null, null, 0]]);
});

test("a rate takes the latest verified period and has no percent of target", () => {
  const rows = breakdownProgress({
    type: "PERCENTAGE", targets: [e("Women", "80")],
    updates: [
      { periodEnd: "2026-06-30", verified: true, entries: [e("Women", "70")] },
      { periodEnd: "2026-03-31", verified: true, entries: [e("Women", "55")] },
    ],
  });
  assert.deepEqual([rows[0].actual, rows[0].percentOfTarget], [70, null], "June is the latest, whatever order they arrive in");
});

test("a target that is not a number, or is zero, shows no percentage", () => {
  const rows = breakdownProgress({ type: "NUMBER", targets: [e("Women", "many"), e("Men", "0")], updates: [{ periodEnd: "2026-03-31", verified: true, entries: [e("Women", "5"), e("Men", "5")] }] });
  assert.deepEqual(rows.map((r) => [r.target, r.actual, r.percentOfTarget]), [[null, 5, null], [0, 5, null]]);
});
