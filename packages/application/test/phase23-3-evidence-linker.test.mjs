import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceLinkService, AttachEvidenceHandler, DetachEvidenceHandler } from "../dist/index.js";
import { TenantId, EvidenceFile, ActivityUpdate, IndicatorUpdate } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u-1", role: "ADMIN" }, requestId: "r" };

function evidence(id, over = {}) {
  return EvidenceFile.create({ id, tenantId: "tenant-a", projectId: "p-1", fileName: "f.pdf", title: "Photo", fileUrl: "http://x", fileType: "application/pdf", fileSize: 1, evidenceType: "PHOTO", uploadedById: "u-1", ...over });
}
function activity(id) {
  return ActivityUpdate.create({ id, tenantId: "tenant-a", projectId: "p-1", reportingPeriodId: "rp-1", activityTitle: "Training", activityDate: new Date("2026-02-01"), summary: "s", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", submittedById: "u-1" });
}
function iUpdate(id, indicatorId = "ind-1", periodId = "rp-1") {
  return IndicatorUpdate.create({ id, tenantId: "tenant-a", indicatorId, reportingPeriodId: periodId, periodAchievement: "5", cumulativeAchievement: "5", createdById: "u-1" });
}

function world({ ev = [], acts = [], ups = [] } = {}) {
  const E = new Map(ev.map((e) => [e.id, e]));
  const A = new Map(acts.map((a) => [a.id, a]));
  const U = new Map(ups.map((u) => [u.id, u]));
  const audit = { events: [], async record(e) { this.events.push(e); } };
  const repo = {
    async findById(id) { return { ok: true, value: E.get(id) ?? null }; },
    async update(e) { E.set(e.id, e); return { ok: true, value: e }; },
    async search(f) { const items = [...E.values()].filter((e) => (!f.indicatorId || e.indicatorId === f.indicatorId) && (!f.reportingPeriodId || e.reportingPeriodId === f.reportingPeriodId)); return { ok: true, value: { items, total: items.length, page: 1, pageSize: 200 } }; },
  };
  const actRepo = { async findById(id) { return { ok: true, value: A.get(id) ?? null }; }, async update(a) { A.set(a.id, a); return { ok: true, value: a }; } };
  const upRepo = {
    async findById(id) { return { ok: true, value: U.get(id) ?? null }; },
    async update(u) { U.set(u.id, u); return { ok: true, value: u }; },
    async findByIndicatorAndPeriod(i, p) { return { ok: true, value: [...U.values()].find((u) => u.indicatorId === i && u.reportingPeriodId === p) ?? null }; },
  };
  return { E, A, U, audit, linker: new EvidenceLinkService(repo, actRepo, upRepo, audit) };
}

test("upload against an activity attaches at once", async () => {
  const e = evidence("e-1", { activityId: "a-1" });
  const w = world({ ev: [e], acts: [activity("a-1")] });
  const r = await w.linker.linkOnUpload(ctx, e);
  assert.deepEqual(r.value, { indicator: "NONE", activity: true });
  assert.deepEqual(w.A.get("a-1").attachedEvidenceIds, ["e-1"]);
});

test("upload against an indicator with a value for the period attaches; the file keeps the indicator and gains the update link", async () => {
  const e = evidence("e-1", { indicatorId: "ind-1", reportingPeriodId: "rp-1" });
  const w = world({ ev: [e], ups: [iUpdate("u-1")] });
  const r = await w.linker.linkOnUpload(ctx, e);
  assert.equal(r.value.indicator, "ATTACHED");
  assert.deepEqual(w.U.get("u-1").attachedEvidenceIds, ["e-1"]);
  assert.equal(e.indicatorId, "ind-1");
  assert.equal(e.indicatorUpdateId, "u-1");
});

test("with no value yet it stays a tag (PENDING) and is attached when the value is first created", async () => {
  const e = evidence("e-1", { indicatorId: "ind-1", reportingPeriodId: "rp-1" });
  const w = world({ ev: [e] });
  assert.equal((await w.linker.linkOnUpload(ctx, e)).value.indicator, "PENDING");
  assert.equal(e.indicatorUpdateId, undefined);
  const created = iUpdate("u-9");
  w.U.set("u-9", created);
  const n = await w.linker.attachPendingFor(ctx, created);
  assert.equal(n.value, 1);
  assert.deepEqual(created.attachedEvidenceIds, ["e-1"]);
  assert.equal(e.indicatorUpdateId, "u-9");
  assert.equal((await w.linker.attachPendingFor(ctx, created)).value, 0);
});

test("a file with no period or target is just not linked", async () => {
  const e = evidence("e-1");
  assert.deepEqual((await world({ ev: [e] }).linker.linkOnUpload(ctx, e)).value, { indicator: "NONE", activity: false });
  const e2 = evidence("e-2", { indicatorId: "ind-1" });
  assert.equal((await world({ ev: [e2] }).linker.linkOnUpload(ctx, e2)).value.indicator, "PENDING");
});

test("attach accepts an update id, or an indicator id resolved through the file's period; unknown is NOT_FOUND", async () => {
  const e = evidence("e-1", { reportingPeriodId: "rp-1" });
  const w = world({ ev: [e], ups: [iUpdate("u-1")] });
  const h = new AttachEvidenceHandler(w.linker);
  assert.equal((await h.handle(ctx, { evidenceId: "e-1", indicatorId: "u-1" })).ok, true);
  const e2 = evidence("e-2", { reportingPeriodId: "rp-1" });
  w.E.set("e-2", e2);
  assert.equal((await h.handle(ctx, { evidenceId: "e-2", indicatorId: "ind-1" })).ok, true);
  assert.deepEqual(w.U.get("u-1").attachedEvidenceIds, ["e-1", "e-2"]);
  const missing = await h.handle(ctx, { evidenceId: "e-1", indicatorId: "nope" });
  assert.equal(missing.error.code, "NOT_FOUND");
  assert.equal((await h.handle(ctx, { evidenceId: "e-1" })).ok, false);
});

test("attach is idempotent and audits each call", async () => {
  const e = evidence("e-1");
  const w = world({ ev: [e], acts: [activity("a-1")] });
  const h = new AttachEvidenceHandler(w.linker);
  await h.handle(ctx, { evidenceId: "e-1", activityId: "a-1" });
  await h.handle(ctx, { evidenceId: "e-1", activityId: "a-1" });
  assert.deepEqual(w.A.get("a-1").attachedEvidenceIds, ["e-1"]);
  assert.equal(w.audit.events.filter((x) => x.eventType === "evidence.attached_to_activity").length, 2);
  assert.equal(w.audit.events.filter((x) => x.eventType === "evidence.period_derived").length, 1);
});

test("a file linked to an activity inherits the activity's period", async () => {
  const e = evidence("e-1", { activityId: "a-1" });
  const w = world({ ev: [e], acts: [activity("a-1")] });
  await w.linker.linkOnUpload(ctx, e);
  assert.equal(e.reportingPeriodId, "rp-1");
  assert.equal(w.audit.events.some((x) => x.eventType === "evidence.period_derived"), true);
});

test("an explicit period wins over the activity's", async () => {
  const e = evidence("e-1", { activityId: "a-1", reportingPeriodId: "rp-9" });
  const w = world({ ev: [e], acts: [activity("a-1")] });
  await w.linker.linkOnUpload(ctx, e);
  assert.equal(e.reportingPeriodId, "rp-9");
  assert.equal(w.audit.events.some((x) => x.eventType === "evidence.period_derived"), false);
});

test("an indicator tag on a file with only an activity resolves the value through the derived period", async () => {
  const e = evidence("e-1", { activityId: "a-1", indicatorId: "ind-1" });
  const w = world({ ev: [e], acts: [activity("a-1")], ups: [iUpdate("u-1")] });
  const r = await w.linker.linkOnUpload(ctx, e);
  assert.equal(r.value.indicator, "ATTACHED");
});

test("detach clears the proof link but keeps the indicator tag", async () => {
  const e = evidence("e-1", { indicatorId: "ind-1", reportingPeriodId: "rp-1" });
  const w = world({ ev: [e], ups: [iUpdate("u-1")] });
  await w.linker.linkOnUpload(ctx, e);
  const r = await new DetachEvidenceHandler(w.linker).handle(ctx, { evidenceId: "e-1", indicatorId: "u-1" });
  assert.equal(r.ok, true);
  assert.deepEqual(w.U.get("u-1").attachedEvidenceIds, []);
  assert.equal(e.indicatorUpdateId, undefined);
  assert.equal(e.indicatorId, "ind-1");
});

test("detach from an activity clears both sides", async () => {
  const e = evidence("e-1", { activityId: "a-1" });
  const w = world({ ev: [e], acts: [activity("a-1")] });
  await w.linker.linkOnUpload(ctx, e);
  await new DetachEvidenceHandler(w.linker).handle(ctx, { evidenceId: "e-1", activityId: "a-1" });
  assert.deepEqual(w.A.get("a-1").attachedEvidenceIds, []);
  assert.equal(e.activityId, undefined);
});

import { GetEvidenceSupportHandler } from "../dist/index.js";
import { Indicator } from "@donordesk/domain";

test("support lists attached and tagged files and the statements that cite them", async () => {
  const attached = evidence("e-att");
  const taggedOnly = evidence("e-tag", { activityId: "a-1" });
  const act = activity("a-1");
  act.attachEvidence("e-att");
  const E = new Map([[attached.id, attached], [taggedOnly.id, taggedOnly]]);
  const evRepo = {
    async findById(id) { return { ok: true, value: E.get(id) ?? null }; },
    async search(f) { const items = [...E.values()].filter((e) => e.activityId === f.activityId); return { ok: true, value: { items, total: items.length, page: 1, pageSize: 200 } }; },
  };
  const claim = { id: "c-1", sectionId: "s-1", text: "Children attended.", sources: [{ evidenceId: "e-att" }] };
  const h = new GetEvidenceSupportHandler(
    evRepo,
    { async findById() { return { ok: true, value: act }; } },
    { async findById() { return { ok: true, value: null }; } },
    { async findByIndicator() { return { ok: true, value: [] }; } },
    { async findCitingEvidence(_p, ids) { return { ok: true, value: ids.includes("e-att") ? [claim] : [] }; } },
    { async findById() { return { ok: true, value: { sectionTitle: "Results" } }; } },
  );
  const r = await h.handle(ctx, { type: "activity", id: "a-1" });
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.value.files.map((f) => [f.id, f]));
  assert.equal(byId["e-att"].attached, true);
  assert.deepEqual(byId["e-att"].citedBy, [{ claimId: "c-1", sectionId: "s-1", sectionTitle: "Results", text: "Children attended." }]);
  assert.equal(byId["e-tag"].attached, false);
  assert.deepEqual(byId["e-tag"].citedBy, []);
});

test("support for an unknown target is NOT_FOUND", async () => {
  const none = { async findById() { return { ok: true, value: null }; } };
  const h = new GetEvidenceSupportHandler({}, none, none, {}, {}, {});
  assert.equal((await h.handle(ctx, { type: "activity", id: "x" })).error.code, "NOT_FOUND");
  assert.equal((await h.handle(ctx, { type: "indicator", id: "x" })).error.code, "NOT_FOUND");
});
