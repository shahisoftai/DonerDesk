import assert from "node:assert/strict";
import test from "node:test";
import { ApproveReportHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId) => ({ tenant: { tenantId, userId }, requestId: "r" });

function build({ requireSecondApprover = false, members = [] } = {}) {
  const audits = [];
  const approved = [];
  const draft = { id: "d", projectId: "p", reportingPeriodId: "per", createdById: "author", approve: (u) => approved.push(u) };
  const h = new ApproveReportHandler(
    { findById: async () => ok(draft), update: async (d) => ok(d) },
    { findById: async () => ok({ status: { toString: () => "X" }, transitionTo() {}, advanceStatus() {} }), update: async (p) => ok(p) },
    {}, {}, {}, {}, {},
    { record: async (e) => { audits.push(e.eventType); } },
    undefined, undefined,
    {
      profiles: { findByProject: async () => ok({ requireSecondApprover }) },
      projects: { findById: async () => ok({ projectManagerId: undefined, meOfficerId: undefined }) },
      members: { findByProject: async () => ok(members) },
    },
  );
  h.evaluateGate = async () => ok({ approvalBlocked: false, submitBlocked: false, submitNeedsDecision: false, blockReasons: [], blockingIssues: [] });
  return { h, audits, approved };
}
const pm = { userId: "pm", role: "PROJECT_MANAGER", status: "ACTIVE" };

test("rule off: the author may approve their own report, and the self sign-off is recorded", async () => {
  const w = build();
  const r = await w.h.handle(as("author"), "d");
  assert.equal(r.ok, true);
  assert.deepEqual(w.audits, ["report.approved", "signoff.self"]);
});

test("rule on: the author is refused and told who can approve; another person may", async () => {
  const w = build({ requireSecondApprover: true, members: [pm] });
  const refused = await w.h.handle(as("author"), "d");
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /other than you/);
  assert.deepEqual(w.approved, []);
  assert.equal((await w.h.handle(as("pm"), "d")).ok, true);
  assert.deepEqual(w.audits, ["report.approved"], "a second person's approval is not a self sign-off");
});

test("rule on and nobody else assigned: the refusal says what to do", async () => {
  const w = build({ requireSecondApprover: true });
  const r = await w.h.handle(as("author"), "d");
  assert.match(r.error.message, /nobody else is assigned/);
});

test("approverEligibility tells the UI whether to offer Approve, with the same reason the refusal gives", async () => {  const { h } = build({ requireSecondApprover: true, members: [pm] });
  const self = await h.approverEligibility(as("author"), "p", "author");
  assert.equal(self.ok, true);
  assert.equal(self.value.canApprove, false);
  assert.match(self.value.reason, /needs a second person to approve/);
  const other = await h.approverEligibility(as("pm"), "p", "author");
  assert.deepEqual(other.value, { canApprove: true });
});

test("a team of one with the rule off may approve (recorded as a self sign-off elsewhere)", async () => {
  const { h } = build({ requireSecondApprover: false });
  const r = await h.approverEligibility(as("author"), "p", "author");
  assert.deepEqual(r.value, { canApprove: true });
});

test("an approved draft is re-checked against the rule, so the seal cannot be bypassed", async () => {
  // The author approved the report themselves; the rule was on when they
  // pressed Approve only because the draft was approved before the rule
  // existed, or because the sections were approved one by one. The seal
  // re-checks the rule against the person who approved the draft.
  const { h } = build({ requireSecondApprover: true, members: [pm] });
  const own = await h.checkApprovedDraftApprover(as("author"), { projectId: "p", createdById: "author", approvedById: "author" });
  assert.equal(own.ok, false);
  assert.match(own.error.message, /other than you/);

  const other = await h.checkApprovedDraftApprover(as("pm"), { projectId: "p", createdById: "author", approvedById: "pm" });
  assert.equal(other.ok, true);
});

test("a rule turned on after the approval still applies to the seal", async () => {
  const { h } = build({ requireSecondApprover: true, members: [pm] });
  const r = await h.checkApprovedDraftApprover(as("author"), { projectId: "p", createdById: "author", approvedById: "author" });
  assert.equal(r.ok, false);
});

test("with the rule off, the author's own approval still seals", async () => {
  const { h } = build({ requireSecondApprover: false });
  const r = await h.checkApprovedDraftApprover(as("author"), { projectId: "p", createdById: "author", approvedById: "author" });
  assert.equal(r.ok, true);
});

test("a draft with no recorded approver cannot be sealed", async () => {
  const { h } = build({ requireSecondApprover: false });
  const r = await h.checkApprovedDraftApprover(as("author"), { projectId: "p", createdById: "author", approvedById: undefined });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /not been approved/);
});
