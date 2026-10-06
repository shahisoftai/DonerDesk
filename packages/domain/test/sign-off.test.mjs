import assert from "node:assert/strict";
import test from "node:test";
import { signOffRoles } from "../dist/index.js";

const member = (userId, role, status = "ACTIVE") => ({ userId, role, status });

test("the demo 5 project: a PM and an M&E officer assigned as project members count as signed-off roles", () => {
  const roles = signOffRoles({ members: [member("u1", "PROJECT_MANAGER"), member("u2", "ME_OFFICER"), member("u3", "FIELD_OFFICER")] });
  assert.equal(roles.projectManager, true);
  assert.equal(roles.meOfficer, true);
  assert.equal(roles.anyoneAssigned, true);
  assert.deepEqual(roles.approverIds, ["u1", "u2"]);
});

test("the project's own fields count too, and either source is enough", () => {
  assert.deepEqual(
    (({ projectManager, meOfficer }) => ({ projectManager, meOfficer }))(signOffRoles({ projectManagerId: "a", meOfficerId: "b", members: [] })),
    { projectManager: true, meOfficer: true },
  );
  const mixed = signOffRoles({ projectManagerId: "a", members: [member("b", "ME_OFFICER")] });
  assert.equal(mixed.projectManager && mixed.meOfficer, true);
  assert.deepEqual(mixed.approverIds, ["a", "b"]);
  assert.equal(signOffRoles({ projectManagerId: "a", members: [member("a", "PROJECT_MANAGER")] }).approverIds.length, 1, "the same person is listed once");
});

test("a removed member holds nothing; nobody assigned means nothing is signed off", () => {
  const removed = signOffRoles({ members: [member("u1", "PROJECT_MANAGER", "REMOVED")] });
  assert.equal(removed.projectManager, false);
  assert.equal(removed.anyoneAssigned, false);
  const nobody = signOffRoles({ members: [] });
  assert.deepEqual([nobody.projectManager, nobody.meOfficer, nobody.reportingOfficer, nobody.anyoneAssigned, nobody.approverIds.length], [false, false, false, false, 0]);
});

test("any active member means the team is assigned, even without a sign-off role", () => {
  assert.equal(signOffRoles({ members: [member("u3", "FIELD_OFFICER")] }).anyoneAssigned, true);
  assert.equal(signOffRoles({ reportingOfficerId: "r", members: [] }).anyoneAssigned, true);
});

import { checkApprover } from "../dist/index.js";

test("approving: anyone may when no second approver is required; your own report is recorded as a self sign-off (25.8)", () => {
  assert.deepEqual(checkApprover({ requireSecondApprover: false, authorId: "u1", approverId: "u2", otherApproverCount: 1 }), { ok: true, selfApproval: false });
  assert.deepEqual(checkApprover({ requireSecondApprover: false, authorId: "u1", approverId: "u1", otherApproverCount: 0 }), { ok: true, selfApproval: true });
  assert.deepEqual(checkApprover({ requireSecondApprover: true, authorId: "u1", approverId: "u2", otherApproverCount: 1 }), { ok: true, selfApproval: false });
});

test("with a second approver required, the author cannot approve and is told who can or what to do", () => {
  const withOthers = checkApprover({ requireSecondApprover: true, authorId: "u1", approverId: "u1", otherApproverCount: 2 });
  assert.equal(withOthers.ok, false);
  assert.match(withOthers.reason, /other than you/);
  const alone = checkApprover({ requireSecondApprover: true, authorId: "u1", approverId: "u1", otherApproverCount: 0 });
  assert.match(alone.reason, /nobody else is assigned/);
  assert.equal(checkApprover({ requireSecondApprover: true, authorId: undefined, approverId: "u1", otherApproverCount: 0 }).ok, true, "an unknown author is not blocked");
});
