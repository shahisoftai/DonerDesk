import { test } from "node:test";
import assert from "node:assert/strict";
import { outlineLogframe, eligibleParents, canParentLevel, logframeLevelRank } from "../../src/features/logframe/domain/logframe-outline.ts";

const items = [
  { id: "g", level: "GOAL", title: "Goal" },
  { id: "o2", level: "OUTCOME", parentId: "g", title: "O2" },
  { id: "o1", level: "OUTCOME", parentId: "g", title: "O1" },
  { id: "op", level: "OUTPUT", parentId: "o1", title: "Out" },
  { id: "orphan", level: "OUTPUT", parentId: "missing", title: "Orphan" },
];

test("outline keeps API order, depth, parent and sibling position", () => {
  const rows = outlineLogframe(items);
  assert.deepEqual(rows.map((r) => [r.item.id, r.depth, r.parentId, r.index, r.siblingCount]), [
    ["g", 0, null, 0, 2],
    ["o2", 1, "g", 0, 2],
    ["o1", 1, "g", 1, 2],
    ["op", 2, "o1", 0, 1],
    ["orphan", 0, null, 1, 2],
  ]);
  assert.equal("children" in rows[0].item, false);
});

test("eligible parents exclude self, descendants and non-higher levels", () => {
  assert.deepEqual(eligibleParents(items, { id: "o1", level: "OUTCOME" }).map((i) => i.id), ["g"]);
  assert.deepEqual(eligibleParents(items, { level: "ACTIVITY" }).map((i) => i.id), ["g", "o2", "o1", "op", "orphan"]);
  assert.deepEqual(eligibleParents(items, { id: "g", level: "GOAL" }), []);
});

test("level rank and parent rule", () => {
  assert.equal(logframeLevelRank("GOAL"), 0);
  assert.equal(logframeLevelRank("WHATEVER"), 4);
  assert.equal(canParentLevel("GOAL", "ACTIVITY"), true);
  assert.equal(canParentLevel("ACTIVITY", "OUTPUT"), false);
});
