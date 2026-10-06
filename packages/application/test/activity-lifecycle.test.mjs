import assert from "node:assert/strict";
import test from "node:test";
import { ActivityUpdate, TenantId } from "@donordesk/domain";
import { BulkReviewActivitiesHandler, RestoreActivityHandler, ResubmitActivityHandler, ReviewActivityHandler, WithdrawActivityHandler, PlanClosingReportHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u-1", role: "ADMIN" }, requestId: "r" };

function activity(id, status = "SUBMITTED", over = {}) {
  return ActivityUpdate.rehydrate({
    id, tenantId: "tenant-a", projectId: "p-1", createdAt: new Date(),
    props: { reportingPeriodId: "rp-1", activityTitle: `A ${id}`, activityDate: new Date("2026-03-06"), summary: "Held the session.", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], status, submittedById: "u-1", ...over },
  });
}
function world(list) {
  const A = new Map(list.map((a) => [a.id, a]));
  const audit = { events: [], async record(e) { this.events.push(e); } };
  const repo = { async findById(id) { return { ok: true, value: A.get(id) ?? null }; }, async update(a) { A.set(a.id, a); return { ok: true, value: a }; } };
  return { A, audit, repo };
}

test("resubmit applies corrections, strips the reviewer note and returns the record to review", async () => {
  const a = activity("a1", "SUBMITTED");
  a.requestRevision("Name the village.");
  const w = world([a]);
  const r = await new ResubmitActivityHandler(w.repo, w.audit).handle(ctx, { activityId: "a1", patch: { location: "Bhan Syedabad" } });
  assert.equal(r.ok, true);
  const saved = w.A.get("a1");
  assert.equal(saved.status, "SUBMITTED");
  assert.equal(saved.location, "Bhan Syedabad");
  assert.equal(saved.summary, "Held the session.");
  assert.equal(w.audit.events[0].eventType, "activity.resubmitted");
});

test("resubmit is refused for a record that was not sent back, and for an unknown one", async () => {
  const w = world([activity("a1", "SUBMITTED")]);
  const h = new ResubmitActivityHandler(w.repo, w.audit);
  assert.equal((await h.handle(ctx, { activityId: "a1" })).ok, false);
  assert.equal((await h.handle(ctx, { activityId: "nope" })).ok, false);
  assert.equal(w.audit.events.length, 0);
});

test("withdraw records the replacement and is audited; restore reverses it", async () => {
  const w = world([activity("old", "NEEDS_REVISION"), activity("new", "ACCEPTED")]);
  const withdrawn = await new WithdrawActivityHandler(w.repo, w.audit).handle(ctx, { activityId: "old", supersededById: "new" });
  assert.equal(withdrawn.ok, true);
  assert.equal(w.A.get("old").status, "WITHDRAWN");
  assert.equal(w.A.get("old").supersededById, "new");
  const restored = await new RestoreActivityHandler(w.repo, w.audit).handle(ctx, "old");
  assert.equal(restored.ok, true);
  assert.equal(w.A.get("old").status, "SUBMITTED");
  assert.deepEqual(w.audit.events.map((e) => e.eventType), ["activity.withdrawn", "activity.restored"]);
});

test("withdraw is refused for an accepted record, itself, another project's record, or a withdrawn replacement", async () => {
  const elsewhere = ActivityUpdate.rehydrate({ id: "elsewhere", tenantId: "tenant-a", projectId: "p-2", createdAt: new Date(), props: { reportingPeriodId: "rp-9", activityTitle: "Other project", activityDate: new Date("2026-03-06"), summary: "s", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], status: "ACCEPTED", submittedById: "u-1" } });
  const w = world([activity("acc", "ACCEPTED"), activity("old", "REJECTED"), activity("gone", "WITHDRAWN"), elsewhere]);
  const h = new WithdrawActivityHandler(w.repo, w.audit);
  assert.equal((await h.handle(ctx, { activityId: "acc" })).ok, false);
  assert.equal((await h.handle(ctx, { activityId: "old", supersededById: "old" })).ok, false);
  assert.equal((await h.handle(ctx, { activityId: "old", supersededById: "gone" })).ok, false);
  assert.equal((await h.handle(ctx, { activityId: "old", supersededById: "missing" })).ok, false);
  assert.equal((await h.handle(ctx, { activityId: "old", supersededById: "elsewhere" })).ok, false);
  assert.equal(w.A.get("old").status, "REJECTED");
  assert.equal(w.audit.events.length, 0);
});

test("restore of a record that is not withdrawn is refused", async () => {
  const w = world([activity("a1", "SUBMITTED")]);
  assert.equal((await new RestoreActivityHandler(w.repo, w.audit).handle(ctx, "a1")).ok, false);
});

test("bulk accept repeats the single review: six records, one action, per-record results, one failure does not stop the rest", async () => {
  const list = [activity("a1"), activity("a2"), activity("a3"), activity("a4", "ACCEPTED"), activity("a5"), activity("a6", "WITHDRAWN")];
  const w = world(list);
  const bulk = new BulkReviewActivitiesHandler(new ReviewActivityHandler(w.repo, w.audit));
  const r = await bulk.handle(ctx, { activityIds: ["a1", "a2", "a3", "a4", "a5", "a6", "a1", "missing"], decision: "ACCEPT", notes: "Checked against registers." });
  assert.equal(r.succeeded, 4);
  assert.equal(r.failed, 3);
  assert.deepEqual(r.results.filter((x) => !x.ok).map((x) => x.activityId), ["a4", "a6", "missing"]);
  for (const id of ["a1", "a2", "a3", "a5"]) assert.equal(w.A.get(id).status, "ACCEPTED", id);
  assert.equal(w.A.get("a6").status, "WITHDRAWN");
  // each accepted record has its own audit event, exactly as one-by-one
  assert.equal(w.audit.events.filter((e) => e.eventType === "activity.accept").length, 4);
});

test("bulk review can ask for revision with the shared note", async () => {
  const w = world([activity("a1"), activity("a2")]);
  const r = await new BulkReviewActivitiesHandler(new ReviewActivityHandler(w.repo, w.audit)).handle(ctx, { activityIds: ["a1", "a2"], decision: "REVISE", notes: "Add dates." });
  assert.equal(r.succeeded, 2);
  assert.match(w.A.get("a1").summary, /\[Reviewer note\]: Add dates\./);
});

test("a single review of a refused transition is a normal failure, not an exception", async () => {
  const w = world([activity("a1", "WITHDRAWN")]);
  const r = await new ReviewActivityHandler(w.repo, w.audit).handle(ctx, "a1", { decision: "ACCEPT" });
  assert.equal(r.ok, false);
});

test("the closing plan no longer counts a withdrawn record as not accepted", async () => {
  const activities = [activity("a1", "ACCEPTED"), activity("a2", "WITHDRAWN"), activity("a3", "NEEDS_REVISION")];
  const project = { status: "ACTIVE", duration: { start: new Date("2026-01-01"), end: new Date("2026-12-31") }, projectManagerId: "pm", meOfficerId: "me" };
  const handler = new PlanClosingReportHandler(
    { findById: async () => ({ ok: true, value: project }) },
    { findByProject: async () => ({ ok: true, value: [] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: [] }) },
    { findByProject: async () => ({ ok: true, value: [] }) },
    { findByIndicator: async () => ({ ok: true, value: [] }) },
    { findByProject: async () => ({ ok: true, value: activities }) },
    { findByProject: async () => ({ ok: true, value: null }) },
    { findById: async () => ({ ok: true, value: null }) },
  );
  const plan = await handler.handle(ctx, "p-1");
  assert.equal(plan.ok, true);
  const step = plan.value.steps.find((s) => s.key === "activities");
  assert.match(step.detail, /1 activity record not accepted/);
});
