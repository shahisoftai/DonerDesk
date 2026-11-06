import test from "node:test";
import assert from "node:assert/strict";
import { COMMENTABLE_ENTITIES, COMMENTABLE_TYPES, commentRecipients } from "../dist/index.js";

test("every commentable thing has a plain label", () => {
  for (const t of COMMENTABLE_TYPES) assert.ok(COMMENTABLE_ENTITIES[t].label.length > 2);
  assert.ok(COMMENTABLE_TYPES.includes("planned_activity") && COMMENTABLE_TYPES.includes("project_risk") && COMMENTABLE_TYPES.includes("indicator"));
});
test("owners are told for PEOPLE things, never the author, never twice", () => {
  assert.deepEqual(commentRecipients("planned_activity", "a", "m", ["a", "o", "m"]), ["m", "o"]);
});
test("MENTIONS things tell only the person mentioned", () => {
  assert.deepEqual(commentRecipients("report_section", "a", "m", ["o"]), ["m"]);
  assert.deepEqual(commentRecipients("report_section", "a", undefined, ["o"]), []);
});
