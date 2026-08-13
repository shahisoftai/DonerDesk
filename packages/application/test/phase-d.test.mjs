import assert from "node:assert/strict";
import test from "node:test";
import { RecomputeReadinessHandler, GenerateDeadlineRemindersHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

test("recompute-readiness handler delegates to calculate readiness", async () => {
  let called;
  const delegate = { handle: async (_c, reportingPeriodId) => { called = reportingPeriodId; return { ok: true, value: { score: 1 } }; } };
  const handler = new RecomputeReadinessHandler(delegate);
  const result = await handler.handle(ctx, "period-1");
  assert.equal(result.ok, true);
  assert.equal(called, "period-1");
});

test("deadline-reminders handler creates a notification when sections are pending", async () => {
  const drafts = { findByReportingPeriod: async () => ({ ok: true, value: [{ id: "d1" }] }) };
  const sections = { findByReportDraft: async () => ({ ok: true, value: [{ status: "DRAFT" }] }) };
  let created;
  const notifications = { create: async (input) => { created = input; return { ok: true, value: undefined }; } };
  let notified;
  const notify = { notify: async (input) => { notified = input; } };
  const ids = { generate: () => "n1" };
  const handler = new GenerateDeadlineRemindersHandler(ids, drafts, sections, notifications, notify);

  const result = await handler.handle(ctx, { reportingPeriodId: "p1", recipientId: "user-1" });
  assert.equal(result.ok, true);
  assert.equal(result.value.pendingSections, 1);
  assert.equal(result.value.remindersCreated, 1);
  assert.equal(created.type, "DEADLINE_REMINDER");
  assert.equal(created.recipientId, "user-1");
  assert.equal(notified.type, "DEADLINE_REMINDER");
});

test("deadline-reminders handler does not notify when no sections are pending", async () => {
  const drafts = { findByReportingPeriod: async () => ({ ok: true, value: [{ id: "d1" }] }) };
  const sections = { findByReportDraft: async () => ({ ok: true, value: [{ status: "APPROVED" }] }) };
  let created = 0;
  const notifications = { create: async () => { created += 1; return { ok: true, value: undefined }; } };
  const notify = { notify: async () => {} };
  const ids = { generate: () => "n1" };
  const handler = new GenerateDeadlineRemindersHandler(ids, drafts, sections, notifications, notify);

  const result = await handler.handle(ctx, { reportingPeriodId: "p1", recipientId: "user-1" });
  assert.equal(result.value.pendingSections, 0);
  assert.equal(result.value.remindersCreated, 0);
  assert.equal(created, 0);
});
