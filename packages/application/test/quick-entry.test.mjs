import assert from "node:assert/strict";
import test from "node:test";
import { AutoReviewService, BulkUpsertIndicatorUpdatesHandler, CreateIndicatorUpdateHandler, QuickEnterIndicatorValueHandler } from "../dist/index.js";
import { TenantId, Indicator, IndicatorUpdate, ReportingPeriod } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (role) => ({ tenant: { tenantId, userId: "user-1", role }, requestId: "r-1" });

function indicator() {
  return Indicator.create({ id: "ind-1", tenantId: "tenant-a", projectId: "proj-1", logframeItemId: "i", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "1000", unit: "people" });
}
function period(id, start, end) {
  return ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "proj-1", reportType: "MONTHLY", startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`), deadline: new Date("2027-12-31T00:00:00Z") });
}

function world({ simpleReview = false, stored = [], evidence = [] } = {}) {
  const rows = new Map(stored.map((u) => [u.id, u]));
  const audits = [];
  const periods = [period("jan", "2027-01-01", "2027-01-31"), period("feb", "2027-02-01", "2027-02-28")];
  const updates = {
    findById: async (id) => ({ ok: true, value: rows.get(id) ?? null }),
    findByIndicator: async () => ({ ok: true, value: [...rows.values()] }),
    findByIndicatorAndPeriod: async (i, p) => ({ ok: true, value: [...rows.values()].find((u) => u.indicatorId === i && u.reportingPeriodId === p) ?? null }),
    create: async (u) => { for (const e of evidence) u.attachEvidence(e); rows.set(u.id, u); return { ok: true, value: u }; },
    update: async (u) => { rows.set(u.id, u); return { ok: true, value: u }; },
  };
  const indicators = { findById: async () => ({ ok: true, value: indicator() }), findByProject: async () => ({ ok: true, value: [indicator()] }) };
  const periodRepo = { findById: async (id) => ({ ok: true, value: periods.find((p) => p.id === id) ?? null }), findByProject: async () => ({ ok: true, value: periods }) };
  const audit = { record: async (e) => { audits.push(e); } };
  const profiles = { findByProject: async () => ({ ok: true, value: { simpleReview } }) };
  const review = new AutoReviewService(updates, profiles, audit);
  const create = new CreateIndicatorUpdateHandler({ generate: () => `u-${rows.size + 1}` }, updates, audit, indicators, periodRepo);
  const quick = new QuickEnterIndicatorValueHandler(indicators, periodRepo, updates, create, review, audit);
  const bulk = new BulkUpsertIndicatorUpdatesHandler({ generate: () => `b-${rows.size + 1}` }, updates, indicators, periodRepo, audit, undefined, undefined, undefined, review);
  return { rows, audits, quick, bulk };
}

test("quick entry finds the period from the date and leaves a draft in the full workflow", async () => {
  const w = world();
  const r = await w.quick.handle(ctxFor("PROJECT_MANAGER"), { indicatorId: "ind-1", date: "2027-02-10", periodAchievement: "40" });
  assert.equal(r.ok, true);
  assert.equal(r.value.reportingPeriodId, "feb");
  assert.equal(r.value.chosenBy, "DATE");
  assert.equal(r.value.outcome, "SAVED_DRAFT");
  assert.equal(w.rows.get(r.value.id).verificationStatus, "DRAFT");
  assert.ok(w.audits.some((e) => e.eventType === "logframe.indicator.quick_entered"));
});

test("quick entry suggests the running total from the previous period, and says so", async () => {
  const prior = IndicatorUpdate.create({ id: "p1", tenantId: "tenant-a", indicatorId: "ind-1", reportingPeriodId: "jan", periodAchievement: "30", cumulativeAchievement: "30", createdById: "u" });
  const w = world({ stored: [prior] });
  const r = await w.quick.handle(ctxFor("FIELD_OFFICER"), { indicatorId: "ind-1", date: "2027-02-10", periodAchievement: "20" });
  assert.equal(r.ok, true);
  assert.equal(r.value.cumulative, "50");
  assert.equal(r.value.cumulativeSource, "SUGGESTED");
  assert.match(r.value.notices[0], /50/);
});

test("a date no period covers is refused and nothing is written", async () => {
  const w = world();
  const r = await w.quick.handle(ctxFor("ADMIN"), { indicatorId: "ind-1", date: "2027-06-01", periodAchievement: "5" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /No reporting period covers 2027-06-01/);
  assert.equal(w.rows.size, 0);
});

test("simple review hands a field officer's value in, with a notice", async () => {
  const w = world({ simpleReview: true });
  const r = await w.quick.handle(ctxFor("FIELD_OFFICER"), { indicatorId: "ind-1", date: "2027-01-15", periodAchievement: "12" });
  assert.equal(r.ok, true);
  assert.equal(r.value.outcome, "HANDED_IN");
  assert.equal(w.rows.get(r.value.id).verificationStatus, "SUBMITTED");
  assert.ok(r.value.notices.some((n) => /handed in/i.test(n)));
  assert.ok(w.audits.some((e) => e.eventType === "logframe.indicator.submitted" && /simple review/.test(e.systemNote)));
});

test("simple review verifies only with a file behind the value and a verifier saving it", async () => {
  const withFile = world({ simpleReview: true, evidence: ["ev-1"] });
  const a = await withFile.quick.handle(ctxFor("PROJECT_MANAGER"), { indicatorId: "ind-1", date: "2027-01-15", periodAchievement: "12" });
  assert.equal(a.value.outcome, "VERIFIED");
  assert.equal(withFile.rows.get(a.value.id).verificationStatus, "VERIFIED");

  const officerWithFile = world({ simpleReview: true, evidence: ["ev-1"] });
  const b = await officerWithFile.quick.handle(ctxFor("FIELD_OFFICER"), { indicatorId: "ind-1", date: "2027-01-15", periodAchievement: "12" });
  assert.equal(b.value.outcome, "HANDED_IN");

  const noFile = world({ simpleReview: true });
  const c = await noFile.quick.handle(ctxFor("PROJECT_MANAGER"), { indicatorId: "ind-1", date: "2027-01-15", periodAchievement: "12" });
  assert.equal(c.value.outcome, "HANDED_IN");
  assert.match(c.value.notices.join(" "), /Attach a file/);
});

test("the sheet's Save hands values in only when it asks to, and only with simple review on", async () => {
  const row = { indicatorId: "ind-1", periodAchievement: "7", cumulativeAchievement: "7" };
  const auto = world({ simpleReview: true });
  const a = await auto.bulk.handle(ctxFor("FIELD_OFFICER"), { reportingPeriodId: "jan", updates: [row] });
  assert.equal(a.value.handedIn, 0);
  assert.equal([...auto.rows.values()][0].verificationStatus, "DRAFT");

  const explicit = world({ simpleReview: true });
  const b = await explicit.bulk.handle(ctxFor("FIELD_OFFICER"), { reportingPeriodId: "jan", handIn: true, updates: [row] });
  assert.equal(b.value.handedIn, 1);
  assert.equal([...explicit.rows.values()][0].verificationStatus, "SUBMITTED");

  const full = world({ simpleReview: false });
  const c = await full.bulk.handle(ctxFor("FIELD_OFFICER"), { reportingPeriodId: "jan", handIn: true, updates: [row] });
  assert.equal(c.value.handedIn, 0);
  assert.equal([...full.rows.values()][0].verificationStatus, "DRAFT");
});

test("the existing value checks still apply: a figure that cannot be right is refused", async () => {
  const w = world();
  const r = await w.quick.handle(ctxFor("ADMIN"), { indicatorId: "ind-1", date: "2027-01-15", periodAchievement: "not a number" });
  assert.equal(r.ok, false);
});
