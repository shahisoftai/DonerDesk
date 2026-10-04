import test from "node:test";
import assert from "node:assert/strict";
import { UpdateReportingPeriodScopeHandler } from "../dist/index.js";
import { ReportingPeriod, TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r1" };

function period(reportType, scope, id = "p1") {
  return ReportingPeriod.create({
    id, tenantId: "tenant-a", projectId: "proj", reportType,
    startDate: new Date("2028-05-01"), endDate: new Date("2028-05-07"), deadline: new Date("2028-05-14"),
    scopeJson: JSON.stringify(scope),
  });
}

function setup({ current, others = [], drafts = [], revisions = {}, activityIds = ["a1", "a2", "a3"] }) {
  const audits = [];
  const saved = [];
  const staled = [];
  const periods = {
    findById: async () => ({ ok: true, value: current }),
    findByProject: async () => ({ ok: true, value: [current, ...others] }),
    update: async (p) => (saved.push(p), { ok: true, value: p }),
  };
  const draftRepo = { findByReportingPeriod: async () => ({ ok: true, value: drafts }) };
  const sections = { findByReportDraft: async () => ({ ok: true, value: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] }) };
  const revisionRepo = {
    findCurrentForSection: async (id) => ({ ok: true, value: revisions[id] ?? null }),
    update: async (r) => (staled.push(r), { ok: true, value: r }),
  };
  const activities = { findByProject: async () => ({ ok: true, value: activityIds.map((id) => ({ id })) }) };
  const handler = new UpdateReportingPeriodScopeHandler(periods, draftRepo, sections, revisionRepo, activities, { record: async (e) => audits.push(e) });
  return { handler, audits, saved, staled };
}

const revision = (assuranceState) => ({ assuranceState, markStale() { this.assuranceState = "STALE"; } });

test("an activity report's activities can be changed and are re-validated", async () => {
  const { handler, saved, audits } = setup({ current: period("ACTIVITY", { activityIds: ["a1"] }) });
  const r = await handler.handle(ctx, "p1", { scope: { activityIds: ["a1", "a2"] } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.scope.activityIds, ["a1", "a2"]);
  assert.equal(r.value.changed, true);
  assert.deepEqual(saved[0].scope.activityIds, ["a1", "a2"]);
  assert.equal(audits[0].eventType, "reporting_period.scope_updated");

  const unknown = await setup({ current: period("ACTIVITY", { activityIds: ["a1"] }) }).handler.handle(ctx, "p1", { scope: { activityIds: ["nope"] } });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, "NOT_FOUND");
});

test("an unchanged scope is a no-op: nothing saved, nothing marked stale", async () => {
  const { handler, saved, audits } = setup({ current: period("ACTIVITY", { activityIds: ["a1"] }) });
  const r = await handler.handle(ctx, "p1", { scope: { activityIds: ["a1"] } });
  assert.deepEqual([r.ok, r.value.changed, r.value.staleSections], [true, false, 0]);
  assert.equal(saved.length, 0);
  assert.equal(audits.length, 0);
});

test("cadence reports have no scope to edit", async () => {
  const r = await setup({ current: period("QUARTERLY", {}) }).handler.handle(ctx, "p1", { scope: { title: "x" } });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_FAILED");
});

test("the scope is frozen once the report is under review, approved, exported or submitted", async () => {
  for (const status of ["UNDER_REVIEW", "APPROVED", "EXPORTED", "SUBMITTED"]) {
    const { handler, saved } = setup({ current: period("CUSTOM", { title: "A" }), drafts: [{ id: "d1", status }] });
    const r = await handler.handle(ctx, "p1", { scope: { title: "B" } });
    assert.equal(r.ok, false, status);
    assert.equal(saved.length, 0);
  }
  const ok = await setup({ current: period("CUSTOM", { title: "A" }), drafts: [{ id: "d1", status: "DRAFT" }] }).handler.handle(ctx, "p1", { scope: { title: "B" } });
  assert.equal(ok.ok, true);
});

test("a changed scope marks trusted drafted sections stale and leaves the others alone", async () => {
  const revisions = { s1: revision("CURRENT"), s2: revision("UNASSESSED"), s3: revision("ASSESSING") };
  const { handler, staled } = setup({ current: period("CUSTOM", { title: "A" }), drafts: [{ id: "d1", status: "DRAFT" }], revisions });
  const r = await handler.handle(ctx, "p1", { scope: { title: "B" } });
  assert.equal(r.value.staleSections, 2);
  assert.equal(staled.length, 2);
  assert.equal(revisions.s2.assuranceState, "UNASSESSED");
});

test("situation: the series position is kept while the event stays the same", async () => {
  const current = period("SITUATION", { eventName: "Flood", situationDate: "2028-05-06", sequence: 2, previousPeriodId: "p0", previousSituationDate: "2028-05-01" });
  const { handler } = setup({ current });
  const r = await handler.handle(ctx, "p1", { scope: { eventName: " flood ", situationDate: "2028-05-07", sequence: 9, location: "Sindh" } });
  assert.equal(r.value.scope.sequence, 2, "client sequence ignored, position kept");
  assert.equal(r.value.scope.previousPeriodId, "p0");
  assert.equal(r.value.scope.location, "Sindh");
});

test("situation: moving to another event renumbers against that event's series", async () => {
  const current = period("SITUATION", { eventName: "Flood", situationDate: "2028-05-06", sequence: 2, previousPeriodId: "p0" });
  const other = period("SITUATION", { eventName: "Drought", situationDate: "2028-04-01", sequence: 1 }, "d1");
  const { handler } = setup({ current, others: [other] });
  const r = await handler.handle(ctx, "p1", { scope: { eventName: "drought", situationDate: "2028-05-06" } });
  assert.equal(r.value.scope.sequence, 2);
  assert.equal(r.value.scope.previousPeriodId, "d1");
  assert.equal(r.value.scope.previousSituationDate, "2028-04-01");

  const fresh = await setup({ current, others: [other] }).handler.handle(ctx, "p1", { scope: { eventName: "Earthquake", situationDate: "2028-05-06" } });
  assert.equal(fresh.value.scope.sequence, 1);
  assert.equal(fresh.value.scope.previousPeriodId, undefined);
});

test("missing required scope fields are rejected", async () => {
  const r = await setup({ current: period("SITUATION", { eventName: "Flood", situationDate: "2028-05-06" }) }).handler.handle(ctx, "p1", { scope: { eventName: "Flood" } });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /situationDate/);
});
