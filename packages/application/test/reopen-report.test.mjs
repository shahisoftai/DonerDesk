import assert from "node:assert/strict";
import test from "node:test";
import { ReopenReportHandler } from "../dist/index.js";
import { ReportDraft, ReportingPeriod, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "approver-1", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function setup({ status = "APPROVED", superseded = false } = {}) {
  const draft = ReportDraft.create({ id: "d1", tenantId: "tenant-a", projectId: "proj", reportingPeriodId: "rp", title: "R", generatedByAi: true, createdById: "u" });
  if (status !== "DRAFT") { draft.requestReview(); draft.approve("first-approver"); }
  if (status === "EXPORTED") draft.markExported();
  if (superseded) draft.supersede?.(new Date());
  const period = ReportingPeriod.create({ id: "rp", tenantId: "tenant-a", projectId: "proj", reportType: "MONTHLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31"), deadline: new Date("2026-02-10") });
  if (status !== "DRAFT") period.advanceStatus("APPROVED");
  const events = [];
  const handler = new ReopenReportHandler(
    { findById: async () => ok(draft), update: async (d) => ok(d) },
    { findById: async () => ok(period), update: async (p) => ok(p) },
    { record: async (e) => { events.push(e); } },
  );
  return { handler, draft, period, events };
}

test("reopening needs a real reason", async () => {
  const t = setup();
  assert.equal((await t.handler.handle(ctx, "d1", { reason: "  hi " })).ok, false);
  assert.equal(t.draft.status, "APPROVED");
  assert.equal(t.events.length, 0);
});

test("reopening returns the report to draft and its period to 'draft generated', and audits who, why and the previous approval", async () => {
  const t = setup();
  const r = await t.handler.handle(ctx, "d1", { reason: "Add the screening chart after approval" });
  assert.equal(r.ok, true);
  assert.equal(t.draft.status, "DRAFT");
  assert.equal(t.period.status.value, "DRAFT_GENERATED");
  const e = t.events[0];
  assert.equal(e.eventType, "report.draft.reopened");
  assert.equal(e.actorId, "approver-1");
  assert.equal(JSON.parse(e.newValue).reason, "Add the screening chart after approval");
  const before = JSON.parse(e.oldValue);
  assert.equal(before.status, "APPROVED");
  assert.equal(before.approvedById, "first-approver");
});

test("an exported report can be reopened; a report that is already a draft cannot", async () => {
  const exported = setup({ status: "EXPORTED" });
  assert.equal((await exported.handler.handle(ctx, "d1", { reason: "Correct a caption in the annex" })).ok, true);
  const open = setup({ status: "DRAFT" });
  await assert.rejects(() => open.handler.handle(ctx, "d1", { reason: "No need, it is open already" }), /already open for changes/);
  assert.equal(open.events.length, 0);
});
