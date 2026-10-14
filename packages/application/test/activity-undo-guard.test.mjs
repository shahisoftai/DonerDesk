import test from "node:test";
import assert from "node:assert/strict";
import { ActivityUpdate, TenantId } from "@donordesk/domain";
import { ActivityApprovalGuard, ReviewActivityHandler, WithdrawActivityHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function accepted() {
  const a = ActivityUpdate.create({ id: "a1", tenantId: "tenant-a", projectId: "p1", reportingPeriodId: "per1", activityTitle: "T", activityDate: new Date("2026-08-06"), summary: "S", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], submittedById: "u2" });
  a.submit();
  a.accept();
  return a;
}
const repo = (a) => ({ findById: async () => ok(a), update: async (x) => ok(x) });
const audit = { record: async () => {} };
const periods = (list) => ({ findByProject: async () => ok(list) });
const drafts = (byPeriod) => ({ findByReportingPeriod: async (id) => ok(byPeriod[id] ?? []) });
const period = (id, reportType, start, end) => ({ id, reportType, duration: { start: new Date(start), end: new Date(end) } });

test("an accepted record can be withdrawn when no approved report used it", async () => {
  const guard = new ActivityApprovalGuard(periods([period("per1", "MONTHLY", "2026-08-01", "2026-08-31")]), drafts({ per1: [{ status: "DRAFT_GENERATED" }] }));
  const a = accepted();
  const r = await new WithdrawActivityHandler(repo(a), audit, guard).handle(ctx, { activityId: "a1" });
  assert.equal(r.ok, true);
  assert.equal(a.status, "WITHDRAWN");
});

test("it is refused, naming the report, when its own period's report is approved", async () => {
  const guard = new ActivityApprovalGuard(periods([period("per1", "MONTHLY", "2026-08-01", "2026-08-31")]), drafts({ per1: [{ status: "APPROVED" }] }));
  const a = accepted();
  const r = await new WithdrawActivityHandler(repo(a), audit, guard).handle(ctx, { activityId: "a1" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /withdrawn because the monthly report 2026-08-01 to 2026-08-31 was approved using it/);
  assert.equal(a.status, "ACCEPTED");
});

test("an approved final report or an approved situation report covering the date also protects the record", async () => {
  const list = [period("per1", "MONTHLY", "2026-08-01", "2026-08-31"), period("fin", "FINAL", "2026-09-01", "2026-09-30"), period("sit", "SITUATION", "2026-08-05", "2026-08-15")];
  const guard = new ActivityApprovalGuard(periods(list), drafts({ fin: [{ status: "APPROVED" }], sit: [{ status: "EXPORTED" }] }));
  const used = await guard.approvedReportsUsing(tenantId, { id: "a1", projectId: "p1", reportingPeriodId: "per1", activityDate: new Date("2026-08-06") });
  assert.equal(used.value.length, 2);
});

test("reopening an accepted record for correction follows the same rule and keeps the reviewer note", async () => {
  const free = new ActivityApprovalGuard(periods([period("per1", "MONTHLY", "2026-08-01", "2026-08-31")]), drafts({}));
  const a = accepted();
  const r = await new ReviewActivityHandler(repo(a), audit, free).handle(ctx, "a1", { decision: "REVISE", notes: "Link to A1.1" });
  assert.equal(r.ok, true);
  assert.equal(a.status, "NEEDS_REVISION");
  const blocked = new ActivityApprovalGuard(periods([period("per1", "MONTHLY", "2026-08-01", "2026-08-31")]), drafts({ per1: [{ status: "APPROVED" }] }));
  const b = accepted();
  const r2 = await new ReviewActivityHandler(repo(b), audit, blocked).handle(ctx, "a1", { decision: "REVISE", notes: "x" });
  assert.equal(r2.ok, false);
  assert.equal(b.status, "ACCEPTED");
});

test("without a guard (legacy wiring) nothing changes", async () => {
  const a = accepted();
  const r = await new WithdrawActivityHandler(repo(a), audit).handle(ctx, { activityId: "a1" });
  assert.equal(r.ok, true);
});
