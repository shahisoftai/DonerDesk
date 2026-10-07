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
