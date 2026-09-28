import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutline, canMove, descendantIds, hiddenIds, moveWithSubtree } from "../../src/features/report-editor/application/outline-tree.ts";

// 1 Activity Implementation / 1.1 Progress / 1.1.1 Result 1 / 1.1.1.1 Sub-result /
// 1.2 Challenges / 2 Annexes / Annex I
const SECTIONS = [
  { id: "a", sectionTitle: "Activity Implementation", level: 1 },
  { id: "b", sectionTitle: "Progress Narrative", level: 2 },
  { id: "c", sectionTitle: "Result 1", level: 3 },
  { id: "d", sectionTitle: "Sub-result 1.1", level: 4 },
  { id: "e", sectionTitle: "Challenges", level: 2 },
  { id: "f", sectionTitle: "Annexes", level: 1 },
  { id: "g", sectionTitle: "Annex I Success Stories", level: 2, numbering: "Annex I" },
];

test("buildOutline numbers sections and sub-sections TOC style, up to 4 levels", () => {
  const rows = buildOutline(SECTIONS);
  assert.deepEqual(
    rows.map((r) => [r.label, r.level, r.title]),
    [
      ["1", 1, "Activity Implementation"],
      ["1.1", 2, "Progress Narrative"],
      ["1.1.1", 3, "Result 1"],
      ["1.1.1.1", 4, "Sub-result 1.1"],
      ["1.2", 2, "Challenges"],
      ["2", 1, "Annexes"],
      ["Annex I", 2, "Success Stories"],
    ],
  );
  assert.equal(rows[3]!.parentId, "c");
  assert.equal(rows[4]!.parentId, "a");
  assert.deepEqual(rows.map((r) => r.hasChildren), [true, true, true, false, false, true, false]);
});

test("buildOutline: legacy drafts (no level) stay a flat list; skipped levels are closed up", () => {
  assert.deepEqual(buildOutline([{ id: "x", sectionTitle: "A" }, { id: "y", sectionTitle: "B" }]).map((r) => [r.label, r.level]), [["1", 1], ["2", 1]]);
  const rows = buildOutline([
    { id: "x", sectionTitle: "A", level: 2 },
    { id: "y", sectionTitle: "B", level: 4 },
  ]);
  assert.deepEqual(rows.map((r) => [r.label, r.level]), [["1", 1], ["1.1", 2]]);
});

test("collapse hides every descendant, not siblings", () => {
  const rows = buildOutline(SECTIONS);
  assert.deepEqual(descendantIds(rows, "b"), ["c", "d"]);
  assert.deepEqual([...hiddenIds(rows, new Set(["a"]))].sort(), ["b", "c", "d", "e"]);
});

test("moving a section takes its sub-sections and stays among its siblings", () => {
  const rows = buildOutline(SECTIONS);
  assert.deepEqual(moveWithSubtree(rows, "b", 1), ["a", "e", "b", "c", "d", "f", "g"]);
  assert.deepEqual(moveWithSubtree(rows, "e", -1), ["a", "e", "b", "c", "d", "f", "g"]);
  assert.deepEqual(moveWithSubtree(rows, "f", -1), ["f", "g", "a", "b", "c", "d", "e"]);
  // Cannot leave its parent: the last child cannot move down, the first cannot move up.
  assert.equal(canMove(rows, "e", 1), false);
  assert.equal(canMove(rows, "b", -1), false);
  assert.equal(moveWithSubtree(rows, "g", 1), undefined);
});
