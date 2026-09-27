import assert from "node:assert/strict";
import test from "node:test";
import { LogframeItem, planLogframeMove, canParentLogframeLevel } from "../dist/index.js";

let clock = 0;
function item(id, level, parentId, code = id, projectId = "p1") {
  return LogframeItem.rehydrate({
    id, tenantId: "t", projectId, createdAt: new Date(++clock * 1000),
    props: { level, parentId, code, title: `Item ${id}` },
  });
}

function tree() {
  return [
    item("g", "GOAL"),
    item("o1", "OUTCOME", "g", "1"),
    item("o2", "OUTCOME", "g", "2"),
    item("op1", "OUTPUT", "o1", "1.1"),
    item("op2", "OUTPUT", "o1", "1.2"),
    item("x", "OUTCOME", undefined, "x", "other-project"),
  ];
}

test("level rule allows skipping levels but never upward", () => {
  assert.equal(canParentLogframeLevel("GOAL", "OUTPUT"), true);
  assert.equal(canParentLogframeLevel("OUTPUT", "OUTCOME"), false);
  assert.equal(canParentLogframeLevel("OUTCOME", "OUTCOME"), false);
});

test("reorders siblings densely and reports only changed items", () => {
  const items = tree();
  const r = planLogframeMove(items, { itemId: "o2", parentId: "g", index: 0 });
  assert.equal(r.ok, true);
  const byId = new Map(items.map((i) => [i.id, i]));
  assert.equal(byId.get("o2").sortOrder, 0);
  assert.equal(byId.get("o1").sortOrder, 1);
  assert.deepEqual(r.value.map((i) => i.id).sort(), ["o1"]);
});

test("re-parents an output to another outcome at the end", () => {
  const items = tree();
  const r = planLogframeMove(items, { itemId: "op1", parentId: "o2", index: 99 });
  assert.equal(r.ok, true);
  const op1 = items.find((i) => i.id === "op1");
  assert.equal(op1.parentId, "o2");
  assert.equal(op1.sortOrder, 0);
  assert.ok(r.value.some((i) => i.id === "op1"));
});

test("moving to top level clears the parent", () => {
  const items = tree();
  assert.equal(planLogframeMove(items, { itemId: "o1", parentId: null, index: 5 }).ok, true);
  assert.equal(items.find((i) => i.id === "o1").parentId, undefined);
});

test("rejects cycles, wrong levels, unknown and cross-project parents", () => {
  assert.equal(planLogframeMove(tree(), { itemId: "o1", parentId: "op1", index: 0 }).error.code, "VALIDATION_FAILED");
  assert.equal(planLogframeMove(tree(), { itemId: "o1", parentId: "o2", index: 0 }).error.code, "VALIDATION_FAILED");
  assert.equal(planLogframeMove(tree(), { itemId: "g", parentId: "g", index: 0 }).error.code, "VALIDATION_FAILED");
  assert.equal(planLogframeMove(tree(), { itemId: "o1", parentId: "nope", index: 0 }).error.code, "NOT_FOUND");
  assert.equal(planLogframeMove(tree(), { itemId: "op1", parentId: "x", index: 0 }).error.code, "NOT_FOUND");
  assert.equal(planLogframeMove(tree(), { itemId: "nope", parentId: null, index: 0 }).error.code, "NOT_FOUND");
});
