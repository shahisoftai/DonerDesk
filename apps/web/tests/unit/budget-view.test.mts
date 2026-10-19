import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_STATE_WORDS, BUDGET_CATEGORY_WORDS, spentBarPercent } from "../../src/features/workplan/domain/budget-view.ts";

test("every state and category has plain words, and a bar never leaves its track", () => {
  assert.equal(BUDGET_STATE_WORDS.NO_BUDGET, "No budget set");
  assert.equal(BUDGET_STATE_WORDS.OVERSPENT, "Over budget");
  assert.equal(BUDGET_CATEGORY_WORDS.PERSONNEL, "Staff and volunteers");
  assert.equal(spentBarPercent(null), 0);
  assert.equal(spentBarPercent(40), 40);
  assert.equal(spentBarPercent(180), 100);
});
