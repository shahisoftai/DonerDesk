import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkSummary, reviewableIds, toggleSelection, withWithdrawnLast } from "../../src/features/activities/domain/bulk-selection.ts";

const items = [
  { id: "a", status: "SUBMITTED" },
  { id: "b", status: "WITHDRAWN" },
  { id: "c", status: "ACCEPTED" },
  { id: "d", status: "SUBMITTED" },
  { id: "e", status: "NEEDS_REVISION" },
];

test("only submitted records can be selected for review", () => {
  assert.deepEqual(reviewableIds(items), ["a", "d"]);
});

test("toggling adds then removes, without mutating", () => {
  const start = ["a"];
  assert.deepEqual(toggleSelection(start, "d"), ["a", "d"]);
  assert.deepEqual(toggleSelection(["a", "d"], "a"), ["d"]);
  assert.deepEqual(start, ["a"]);
});

test("withdrawn records are listed last, the rest keep their order", () => {
  assert.deepEqual(withWithdrawnLast(items).map((i) => i.id), ["a", "c", "d", "e", "b"]);
});

test("the summary states successes and failures", () => {
  assert.equal(bulkSummary({ succeeded: 6, failed: 0 }), "6 records accepted");
  assert.equal(bulkSummary({ succeeded: 1, failed: 0 }), "1 record accepted");
  assert.equal(bulkSummary({ succeeded: 4, failed: 2 }), "4 records accepted, 2 could not be accepted");
});
