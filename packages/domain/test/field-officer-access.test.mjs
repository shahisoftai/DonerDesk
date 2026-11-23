import test from "node:test";
import assert from "node:assert/strict";
import { Permissions, seesAllRecords, canSeeRecord, canChangeRecord, visibleRecords } from "../dist/index.js";

const ROLES = ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "COMPLIANCE_OFFICER", "FIELD_OFFICER", "VIEWER"];

test("finance.view and results.view: every role but the field officer", () => {
  for (const role of ROLES) {
    const expected = role !== "FIELD_OFFICER";
    assert.equal(Permissions.can(role, "finance.view"), expected, `${role} finance.view`);
    assert.equal(Permissions.can(role, "results.view"), expected, `${role} results.view`);
  }
});

test("the field officer still holds exactly the permissions the field work needs", () => {
  for (const p of ["project.view", "collection.submit", "activity.create", "evidence.upload", "workplan.update-own", "risk.raise", "comment.create", "dataset.contribute"]) {
    assert.ok(Permissions.can("FIELD_OFFICER", p), p);
  }
  for (const p of ["project.edit", "indicator.update", "finance.approve", "users.manage", "org.manage", "report.export"]) {
    assert.ok(!Permissions.can("FIELD_OFFICER", p), p);
  }
});

test("record ownership: managers see all, the field officer sees only their own", () => {
  const rows = [{ id: 1, createdById: "me" }, { id: 2, createdById: "other" }, { id: 3, createdById: "me" }];
  assert.deepEqual(visibleRecords("FIELD_OFFICER", "me", rows).map((r) => r.id), [1, 3]);
  assert.deepEqual(visibleRecords("PROJECT_MANAGER", "me", rows).map((r) => r.id), [1, 2, 3]);
  assert.equal(seesAllRecords("FIELD_OFFICER"), false);
  assert.equal(canSeeRecord("FIELD_OFFICER", "me", rows[1]), false);
  assert.equal(canChangeRecord("FIELD_OFFICER", "me", rows[0]), true);
  assert.equal(canChangeRecord("ME_OFFICER", "me", rows[1]), true);
});

test("visibleRecords does not mutate or reorder its input", () => {
  const rows = [{ createdById: "b" }, { createdById: "a" }];
  const out = visibleRecords("ADMIN", "a", rows);
  assert.deepEqual(out, rows);
  assert.notEqual(out, rows);
});

import { placeIdsWithAncestors } from "../dist/index.js";

test("the places on a phone are the person's own and the areas above them, never the whole list", () => {
  const all = [{ id: "pk" }, { id: "kp", parentId: "pk" }, { id: "swat", parentId: "kp" }, { id: "madyan", parentId: "swat" }, { id: "dir", parentId: "kp" }, { id: "chakdara", parentId: "dir" }, { id: "other", parentId: "pk" }];
  assert.deepEqual([...placeIdsWithAncestors(all, ["madyan", "chakdara"])].sort(), ["chakdara", "dir", "kp", "madyan", "pk", "swat"]);
  assert.deepEqual([...placeIdsWithAncestors(all, [])], []);
  assert.deepEqual([...placeIdsWithAncestors(all, ["unknown"])], []);
  assert.ok(!placeIdsWithAncestors(all, ["madyan"]).has("other"));
  // a loop in bad data ends
  assert.deepEqual([...placeIdsWithAncestors([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], ["a"])].sort(), ["a", "b"]);
});
