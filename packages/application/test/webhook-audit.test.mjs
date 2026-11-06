import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { webhookForAudit, withWebhookEmission, ReportNotifier } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");

test("the audit events that other systems are told about, and as what; everything else is not announced", () => {
  assert.deepEqual(webhookForAudit({ eventType: "logframe.indicator.verified", entityId: "u1", projectId: "p1" }), { event: "indicator.value.verified", data: { indicatorUpdateId: "u1", projectId: "p1", status: "VERIFIED" } });
  assert.equal(webhookForAudit({ eventType: "evidence.verify", entityId: "e1" }).event, "evidence.verified");
  assert.equal(webhookForAudit({ eventType: "evidence.verified", entityId: "e1" }).data.evidenceId, "e1");
  assert.equal(webhookForAudit({ eventType: "activity.accept", entityId: "a1" }).event, "activity.accepted");
  assert.equal(webhookForAudit({ eventType: "report.submission.snapshot.created", entityId: "s1", projectId: "p" }).event, "report.submitted");
  for (const quiet of ["activity.reject", "activity.revise", "evidence.reject", "logframe.indicator.updated", "report.section.updated", "collection.record.accepted"]) {
    assert.equal(webhookForAudit({ eventType: quiet, entityId: "x" }), null, quiet);
  }
  assert.equal(webhookForAudit({ eventType: "evidence.verified", entityId: "" }), null, "no id, nothing to announce");
});

test("the audit event is written first and announced after; a failed write announces nothing; announcing never reaches the caller", async () => {
  const order = [];
  const audit = { listByTenant: async () => "kept", record: async (i) => { order.push(`audit:${i.eventType}`); if (i.eventType === "boom") throw new Error("write failed"); } };
  const emitter = { emit: async (t, event, data) => { order.push(`emit:${event}`); if (event === "evidence.verified") throw new Error("receiver down"); } };
  const wrapped = withWebhookEmission(audit, emitter);
  await wrapped.record({ tenantId, actorId: "u", eventType: "logframe.indicator.verified", entityType: "x", entityId: "u1" });
  await wrapped.record({ tenantId, actorId: "u", eventType: "logframe.indicator.updated", entityType: "x", entityId: "u1" });
  assert.deepEqual(order, ["audit:logframe.indicator.verified", "emit:indicator.value.verified", "audit:logframe.indicator.updated"]);
  await assert.rejects(wrapped.record({ tenantId, actorId: "u", eventType: "boom", entityType: "x", entityId: "u1" }), /write failed/);
  assert.ok(!order.includes("emit:boom"));
  assert.equal(await wrapped.listByTenant(), "kept", "the rest of the logger is untouched");
});

test("approving a report announces it and, with its period, that the period's figures are locked", async () => {
  const events = [];
  const notifier = new ReportNotifier({ send: async () => {} }, {}, {}, { emit: async (t, event, data) => void events.push([event, data]) });
  await notifier.approved(tenantId, "approver", { id: "r1", projectId: "p1", createdById: "author", reportingPeriodId: "per1" });
  assert.deepEqual(events.map((e) => e[0]), ["report.approved", "period.locked"]);
  assert.deepEqual(events[1][1], { periodId: "per1", projectId: "p1", status: "LOCKED" });
  events.length = 0;
  await notifier.approved(tenantId, "approver", { id: "r2", projectId: "p1", createdById: "author" });
  assert.deepEqual(events.map((e) => e[0]), ["report.approved"], "no period known, no lock announced");
});
