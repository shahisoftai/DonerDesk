import test from "node:test";
import assert from "node:assert/strict";
import { filterGroupsByView, reviewCount, REVIEW_KINDS } from "../../src/features/tasks/domain/my-work-view.ts";

const item = (key: string, kind: string) => ({ key, kind, projectId: "p", projectTitle: "P", state: "OPEN" as const });
const groups = [
  { key: "late", label: "Late", items: [item("PLAN_ITEM:1", "PLAN_ITEM"), item("VALUE_REVIEW:1", "VALUE_REVIEW")] },
  { key: "later", label: "Later", items: [item("TASK:1", "TASK")] },
  { key: "none", label: "No date", items: [item("RECORD_REVIEW:f", "RECORD_REVIEW"), item("EVIDENCE_REVIEW:e", "EVIDENCE_REVIEW"), item("ACTIVITY_REVIEW:a", "ACTIVITY_REVIEW"), item("ACTIVITY_FIX:a", "ACTIVITY_FIX")] },
];

test("'To review' keeps only the reviews that come with the person's role, and drops groups left empty", () => {
  const shown = filterGroupsByView(groups, "review");
  assert.deepEqual(shown.map((g) => g.key), ["late", "none"]);
  assert.deepEqual(shown.flatMap((g) => g.items.map((i) => i.key)), ["VALUE_REVIEW:1", "RECORD_REVIEW:f", "EVIDENCE_REVIEW:e", "ACTIVITY_REVIEW:a"]);
});

test("'Everything' is untouched, and a person's own fixes are not reviews", () => {
  assert.equal(filterGroupsByView(groups, "all").length, 3);
  assert.equal(REVIEW_KINDS.includes("ACTIVITY_FIX"), false);
});

test("the review count is what the chip says", () => {
  assert.equal(reviewCount(groups), 4);
  assert.equal(reviewCount([]), 0);
});

test("filtering does not change the input", () => {
  filterGroupsByView(groups, "review");
  assert.equal(groups[0]!.items.length, 2);
});
