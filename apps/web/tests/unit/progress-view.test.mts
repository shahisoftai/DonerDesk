import { test } from "node:test";
import assert from "node:assert/strict";
import { reachedSoFar, entryRange, PROGRESS_KIND_WORDS } from "../../src/features/workplan/domain/progress-view.ts";

const e = (kind: string, total: number | null, absorbedById: string | null = null, from = "2026-10-05") => ({ id: `${kind}-${from}`, kind, from, to: from, values: { total }, absorbedById });

test("reached so far adds live entries once; absorbed and blank ones are left out; nothing recorded is null", () => {
  assert.equal(reachedSoFar([]), null);
  assert.equal(reachedSoFar([e("DAILY", null)]), null, "blank is not zero");
  assert.equal(reachedSoFar([e("DAILY", 12, "m1"), e("MONTHLY", 20)]), 20, "the absorbed day is not counted again");
  assert.equal(reachedSoFar([e("DAILY", 5), e("WEEKLY", 7, null, "2026-10-12"), e("END", 99)]), 12, "the activity-end total is not summed");
});

test("ranges and kind words are plain", () => {
  assert.equal(entryRange({ from: "2026-10-05", to: "2026-10-05" }), "2026-10-05");
  assert.equal(PROGRESS_KIND_WORDS.END, "Whole activity");
});
