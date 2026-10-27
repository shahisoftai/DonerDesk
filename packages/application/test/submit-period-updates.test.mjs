import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, IndicatorUpdate } from "@donordesk/domain";
import { SubmitPeriodIndicatorUpdatesHandler, ListPeriodIndicatorsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "officer", role: "FIELD_OFFICER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const upd = (id, indicatorId, status, p = "5", c = "5") => IndicatorUpdate.rehydrate({ id, tenantId: "tenant-a", createdAt: new Date(), props: { indicatorId, reportingPeriodId: "p1", periodAchievement: p, cumulativeAchievement: c, attachedEvidenceIds: [], verificationStatus: status, createdById: "officer" } });

function world(rows, periodStatus = "NOT_STARTED") {
  const store = new Map(rows.map((r) => [r.id, r]));
  const audit = [];
  const period = { id: "p1", projectId: "proj", status: { value: periodStatus }, reportType: "MONTHLY", scope: undefined, duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30") } };
  const h = new SubmitPeriodIndicatorUpdatesHandler(
    { findByReportingPeriod: async () => ok([...store.values()]), findById: async (id) => ok(store.get(id) ?? null), update: async (u) => (store.set(u.id, u), ok(u)) },
    { findByProject: async () => ok(["a", "b", "c", "d"].map((id) => ({ id, code: id.toUpperCase() }))) },
    { findById: async () => ok(period) },
    { findByReportingPeriod: async () => ok([]) },
    { record: async (e) => void audit.push(e) },
  );
  return { h, store, audit };
}

test("drafts and returned values are handed in, audited per value; handed-in and verified ones are left; a value with no figure is not handed in", async () => {
  const w = world([upd("u1", "a", "DRAFT"), upd("u2", "b", "NEEDS_CORRECTION"), upd("u3", "c", "VERIFIED"), upd("u4", "d", "DRAFT", "", "")]);
  const r = await w.h.handle(ctx, "p1");
  assert.ok(r.ok);
  assert.deepEqual([r.value.submitted, r.value.unchanged, r.value.failed.length], [2, 2, 0]);
  assert.equal(w.store.get("u1").verificationStatus, "SUBMITTED");
  assert.equal(w.store.get("u2").verificationStatus, "SUBMITTED");
  assert.equal(w.store.get("u3").verificationStatus, "VERIFIED");
  assert.equal(w.store.get("u4").verificationStatus, "DRAFT");
  assert.equal(w.audit.length, 2);
  assert.equal(w.audit[0].eventType, "logframe.indicator.submitted");
  assert.equal(r.value.status, "IN_PROGRESS");
});

test("when nothing is left in draft the period reads as waiting for review; submitting again changes nothing", async () => {
  const w = world([upd("u1", "a", "DRAFT"), upd("u2", "b", "VERIFIED")]);
  assert.equal((await w.h.handle(ctx, "p1")).value.status, "SUBMITTED");
  const again = await w.h.handle(ctx, "p1");
  assert.deepEqual([again.value.submitted, again.value.unchanged], [0, 2]);
  assert.equal(w.audit.length, 1);
});

test("a locked report refuses, and a missing period is not found", async () => {
  const locked = world([upd("u1", "a", "DRAFT")], "APPROVED");
  assert.equal((await locked.h.handle(ctx, "p1")).error.code, "CONFLICT");
  assert.equal(locked.store.get("u1").verificationStatus, "DRAFT");
  const h = new SubmitPeriodIndicatorUpdatesHandler({}, {}, { findById: async () => ok(null) }, {}, {});
  assert.equal((await h.handle(ctx, "zz")).error.code, "NOT_FOUND");
});
