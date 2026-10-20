import assert from "node:assert/strict";
import test from "node:test";
import { ReportNotifier, SubmitReportForReviewHandler, RejectReportHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const ctx = (userId) => ({ tenant: { tenantId, userId }, requestId: "r" });

function build() {
  const sent = [];
  const notifier = new ReportNotifier(
    { send: async (n) => { sent.push(n); } },
    { findById: async () => ok({ title: "Water Project", projectManagerId: "pm", meOfficerId: "me" }) },
    { findByProject: async () => ok([{ userId: "lead", role: "PROJECT_MANAGER", status: "ACTIVE" }, { userId: "gone", role: "ME_OFFICER", status: "INACTIVE" }]) },
  );
  return { notifier, sent };
}
const report = { id: "d1", projectId: "p1", createdById: "author" };

test("sending for review tells every approver except the sender", async () => {
  const { notifier, sent } = build();
  await notifier.reviewRequested(tenantId, "pm", report);
  assert.deepEqual(sent.map((n) => n.recipientId).sort(), ["lead", "me"]);
  assert.ok(sent.every((n) => n.relatedEntityId === "d1" && n.title.includes("review")));
});

test("approval and return tell the author, with the reviewer's reason", async () => {
  const { notifier, sent } = build();
  await notifier.approved(tenantId, "pm", report);
  await notifier.returned(tenantId, "pm", report, "  Fix the targets table ");
  assert.deepEqual(sent.map((n) => [n.recipientId, n.type]), [["author", "REPORT_APPROVED"], ["author", "REPORT_RETURNED"]]);
  assert.match(sent[1].message, /Fix the targets table/);
});

test("nobody is told about their own action", async () => {
  const { notifier, sent } = build();
  await notifier.approved(tenantId, "author", report);
  await notifier.returned(tenantId, "author", report);
  assert.equal(sent.length, 0);
});

test("the handlers notify after the change is saved, and a notifier failure cannot undo it", async () => {
  const calls = [];
  const draft = { id: "d1", projectId: "p1", createdById: "author", requestReview() { calls.push("review"); }, reject() { calls.push("reject"); } };
  const drafts = { findById: async () => ok(draft), update: async () => { calls.push("saved"); return ok(draft); } };
  const audit = { record: async () => {} };
  const notifier = {
    reviewRequested: async () => { calls.push("told-approvers"); },
    returned: async (_t, _a, _d, notes) => { calls.push(`told-author:${notes}`); },
  };
  assert.equal((await new SubmitReportForReviewHandler(drafts, audit, notifier).handle(ctx("author"), "d1")).ok, true);
  assert.equal((await new RejectReportHandler(drafts, audit, notifier).handle(ctx("pm"), "d1", "Needs sources")).ok, true);
  assert.deepEqual(calls, ["review", "saved", "told-approvers", "reject", "saved", "told-author:Needs sources"]);
});

test("approving a report tells its author", async () => {
  const { ApproveReportHandler } = await import("../dist/index.js");
  const told = [];
  const draft = { id: "d", projectId: "p", reportingPeriodId: "per", createdById: "author", approve() {} };
  const h = new ApproveReportHandler(
    { findById: async () => ok(draft), update: async (d) => ok(d) },
    { findById: async () => ok({ advanceStatus() {} }), update: async (p) => ok(p) },
    {}, {}, {}, {}, {}, { record: async () => {} }, undefined, undefined, undefined,
    { approved: async (_t, actor, d) => { told.push([actor, d.createdById]); } },
  );
  h.evaluateGate = async () => ok({ approvalBlocked: false, blockReasons: [] });
  assert.equal((await h.handle(ctx("pm"), "d")).ok, true);
  assert.deepEqual(told, [["pm", "author"]]);
});
