import { test } from "node:test";
import assert from "node:assert/strict";
import { indent, outdent, moveUp, moveDown, removeAt, insertChild, insertSiblingAfter, canIndent } from "../../src/features/templates/domain/section-tree-ops.ts";

type N = { id: string; parentId?: string; level: number };
const tree: N[] = [
  { id: "a", level: 1 },
  { id: "a1", parentId: "a", level: 2 },
  { id: "a2", parentId: "a", level: 2 },
  { id: "b", level: 1 },
  { id: "c", level: 1 },
];
const ids = (l: N[]) => l.map((n) => `${n.id}:${n.level}:${n.parentId ?? "-"}`).join(" ");

test("moveUp/moveDown move whole subtrees among siblings", () => {
  assert.equal(ids(moveUp(tree, 3)), "b:1:- a:1:- a1:2:a a2:2:a c:1:-");
  assert.equal(ids(moveDown(tree, 0)), "b:1:- a:1:- a1:2:a a2:2:a c:1:-");
  assert.equal(ids(moveUp(tree, 2)), "a:1:- a2:2:a a1:2:a b:1:- c:1:-");
  assert.equal(ids(moveUp(tree, 0)), ids(tree), "first sibling cannot move up");
});

test("indent makes a node the last child of its previous sibling; outdent reverses it", () => {
  const indented = indent(tree, 3);
  assert.equal(ids(indented), "a:1:- a1:2:a a2:2:a b:2:a c:1:-");
  assert.equal(canIndent(tree, 0), false);
  const out = outdent(tree, 1);
  assert.equal(ids(out), "a:1:- a2:2:a a1:1:- b:1:- c:1:-", "outdented node lands after its old parent's subtree");
});

test("insert and remove keep subtrees intact", () => {
  assert.equal(ids(insertChild(tree, 0, { id: "n", level: 9 })), "a:1:- a1:2:a a2:2:a n:2:a b:1:- c:1:-");
  assert.equal(ids(insertSiblingAfter(tree, 0, { id: "n", level: 9 })), "a:1:- a1:2:a a2:2:a n:1:- b:1:- c:1:-");
  assert.equal(ids(removeAt(tree, 0)), "b:1:- c:1:-");
});
