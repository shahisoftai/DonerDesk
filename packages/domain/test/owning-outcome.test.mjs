import test from "node:test";
import assert from "node:assert/strict";
import { owningOutcome } from "../dist/index.js";

const items = [
  { id: "g", level: "GOAL", code: "G1", title: "Goal" },
  { id: "o1", level: "OUTCOME", parentId: "g", code: "O1", title: "Outcome one" },
  { id: "o2", level: "OUTCOME", parentId: "g", code: "O2", title: "Outcome two" },
  { id: "p11", level: "OUTPUT", parentId: "o1", code: "1.1", title: "Output" },
  { id: "a11", level: "ACTIVITY", parentId: "p11", code: "A1.1", title: "Activity" },
  { id: "loose", level: "OUTPUT", code: "9.9", title: "No parent" },
];

test("an outcome owns itself, its outputs and their activities", () => {
  assert.equal(owningOutcome(items, "o1")?.code, "O1");
  assert.equal(owningOutcome(items, "p11")?.code, "O1");
  assert.equal(owningOutcome(items, "a11")?.code, "O1");
  assert.equal(owningOutcome(items, "o2")?.code, "O2");
});

test("a goal, an unparented item or an unknown id has no owning outcome", () => {
  assert.equal(owningOutcome(items, "g"), undefined);
  assert.equal(owningOutcome(items, "loose"), undefined);
  assert.equal(owningOutcome(items, "nope"), undefined);
  assert.equal(owningOutcome(items, undefined), undefined);
});

test("a parent cycle terminates", () => {
  const cyc = [{ id: "a", level: "OUTPUT", parentId: "b", title: "a" }, { id: "b", level: "OUTPUT", parentId: "a", title: "b" }];
  assert.equal(owningOutcome(cyc, "a"), undefined);
});
