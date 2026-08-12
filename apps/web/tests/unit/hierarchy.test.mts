import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHierarchy, walkHierarchy } from "../../src/lib/shared/hierarchy.ts";

type Item = { id: string; parentId?: string | null; label: string };

const items: Item[] = [
  { id: "g1", label: "Goal" },
  { id: "o1", parentId: "g1", label: "Outcome 1" },
  { id: "o2", parentId: "g1", label: "Outcome 2" },
  { id: "p1", parentId: "o1", label: "Output 1" },
  { id: "orphan", parentId: "missing", label: "Orphan" },
];

test("buildHierarchy groups children under parents and treats dangling parents as roots", () => {
  const tree = buildHierarchy(items);
  const goal = tree.find((n) => n.id === "g1");
  assert.ok(goal);
  assert.equal(goal.children.length, 2);
  assert.equal(goal.children[0]!.children[0]!.id, "p1");
  assert.ok(tree.some((n) => n.id === "orphan"), "orphan becomes a root");
});

test("buildHierarchy preserves item fields", () => {
  const tree = buildHierarchy(items);
  assert.equal(tree[0]!.label, "Goal");
});

test("walkHierarchy visits nodes depth-first with correct depth", () => {
  const tree = buildHierarchy(items);
  const visits: string[] = [];
  const depths: number[] = [];
  walkHierarchy(tree, (node, depth) => {
    visits.push(node.id);
    depths.push(depth);
  });
  const p1Index = visits.indexOf("p1");
  assert.equal(depths[p1Index], 2);
  const goalIndex = visits.indexOf("g1");
  assert.equal(depths[goalIndex], 0);
});
