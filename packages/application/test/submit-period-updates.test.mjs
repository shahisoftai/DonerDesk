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

import { ReturnPeriodIndicatorUpdatesHandler } from "../dist/index.js";

const REVIEWER = { tenant: { tenantId, userId: "boss", role: "PROJECT_MANAGER" }, requestId: "r" };

test("submitting tells the project's reviewers once (not the submitter) and never fails if telling fails", async () => {
  const w = world([upd("u1", "a", "DRAFT"), upd("u2", "b", "DRAFT")]);
  const sent = [];
  const h = new SubmitPeriodIndicatorUpdatesHandler(
    w.h.updates ?? { findByReportingPeriod: async () => ok([...w.store.values()]), findById: async (id) => ok(w.store.get(id)), update: async (u) => (w.store.set(u.id, u), ok(u)) },
    { findByProject: async () => ok([]) }, { findById: async () => ok({ id: "p1", projectId: "proj", status: { value: "NOT_STARTED" }, reportType: "MONTHLY", scope: undefined, duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30") } }) },
    { findByReportingPeriod: async () => ok([]) }, { record: async () => {} },
    { notify: { send: async (n) => void sent.push(n) }, projects: { findById: async () => ok({ title: "Sudan MNCH", projectManagerId: "boss", meOfficerId: "me", reportingOfficerId: undefined }) }, members: { findByProject: async () => ok([]) } },
  );
  const r = await h.handle({ ...ctx, tenant: { ...ctx.tenant, userId: "me" } }, "p1");
  assert.equal(r.value.submitted, 2);
  assert.deepEqual(sent.map((n) => n.recipientId), ["boss"]);
  assert.match(sent[0].message, /2 indicator values for Sudan MNCH have been submitted/);
  const broken = new SubmitPeriodIndicatorUpdatesHandler(
    { findByReportingPeriod: async () => ok([upd("u9", "a", "DRAFT")]), findById: async () => ok(upd("u9", "a", "DRAFT")), update: async (u) => ok(u) },
    { findByProject: async () => ok([]) }, { findById: async () => ok({ id: "p1", projectId: "proj", status: { value: "NOT_STARTED" }, reportType: "MONTHLY", scope: undefined, duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30") } }) },
    { findByReportingPeriod: async () => ok([]) }, { record: async () => {} },
    { notify: { send: async () => { throw new Error("mail down"); } }, projects: { findById: async () => ok({ title: "X", projectManagerId: "boss" }) }, members: { findByProject: async () => ok([]) } },
  );
  assert.equal((await broken.handle(ctx, "p1")).value.submitted, 1);
});

test("sending a period back: a reason is required, only waiting values return, authors are told once with the reason", async () => {
  const w = world([upd("u1", "a", "SUBMITTED"), upd("u2", "b", "SUBMITTED"), upd("u3", "c", "VERIFIED"), upd("u4", "d", "DRAFT")]);
  const sent = [];
  const period = { id: "p1", projectId: "proj", status: { value: "NOT_STARTED" }, reportType: "MONTHLY", scope: undefined, duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30") } };
  const mk = (status = "NOT_STARTED") => new ReturnPeriodIndicatorUpdatesHandler(
    { findByReportingPeriod: async () => ok([...w.store.values()]), findById: async (id) => ok(w.store.get(id) ?? null), update: async (u) => (w.store.set(u.id, u), ok(u)) },
    { findByProject: async () => ok([{ id: "a", code: "A" }]) }, { findById: async () => ok({ ...period, status: { value: status } }) },
    { findByReportingPeriod: async () => ok([]) }, { record: async () => {} }, { send: async (n) => void sent.push(n) },
  );
  assert.match((await mk().handle(REVIEWER, "p1", "  ")).error.message, /Say what needs to change/);
  const r = await mk().handle(REVIEWER, "p1", "Baselines are missing");
  assert.equal(r.value.returned, 2);
  assert.equal(w.store.get("u1").verificationStatus, "NEEDS_CORRECTION");
  assert.equal(w.store.get("u1").reviewNote, "Baselines are missing");
  assert.equal(w.store.get("u3").verificationStatus, "VERIFIED");
  assert.equal(w.store.get("u4").verificationStatus, "DRAFT");
  assert.equal(r.value.status, "RETURNED");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipientId, "officer");
  assert.match(sent[0].message, /2 indicator values were sent back for changes: Baselines are missing/);
  assert.equal((await mk("APPROVED").handle(REVIEWER, "p1", "x")).error.code, "CONFLICT");
});

test("reopening verified values: needs a reason, touches only verified (or the named) values, refuses an approved report", async () => {
  const w = world([upd("u1", "a", "VERIFIED"), upd("u2", "b", "VERIFIED"), upd("u3", "c", "SUBMITTED")]);
  const period = { id: "p1", projectId: "proj", status: { value: "NOT_STARTED" }, reportType: "MONTHLY", scope: undefined, duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30") } };
  const mk = (status = "NOT_STARTED") => new ReturnPeriodIndicatorUpdatesHandler(
    { findByReportingPeriod: async () => ok([...w.store.values()]), findById: async (id) => ok(w.store.get(id) ?? null), update: async (u) => (w.store.set(u.id, u), ok(u)) },
    { findByProject: async () => ok([{ id: "a", code: "A" }]) }, { findById: async () => ok({ ...period, status: { value: status } }) },
    { findByReportingPeriod: async () => ok([]) }, { record: async () => {} },
  );
  assert.match((await mk().reopen(REVIEWER, "p1", " ")).error.message, /Say what needs to change/);
  assert.equal((await mk("APPROVED").reopen(REVIEWER, "p1", "x")).error.code, "CONFLICT");
  const one = await mk().reopen(REVIEWER, "p1", "Add the location breakdown", ["u1"]);
  assert.equal(one.value.returned, 1);
  assert.equal(w.store.get("u1").verificationStatus, "NEEDS_CORRECTION");
  assert.equal(w.store.get("u1").reviewNote, "Add the location breakdown");
  assert.equal(w.store.get("u2").verificationStatus, "VERIFIED");
  const rest = await mk().reopen(REVIEWER, "p1", "Again");
  assert.equal(rest.value.returned, 1);
  assert.equal(w.store.get("u3").verificationStatus, "SUBMITTED");
});
