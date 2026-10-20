import assert from "node:assert/strict";
import test from "node:test";
import { CreateIndicatorUpdateHandler, BulkUpsertIndicatorUpdatesHandler } from "../dist/index.js";
import { TenantId, Indicator, IndicatorUpdate, ReportingPeriod } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

const indicator = Indicator.create({
  id: "ind-1", tenantId: "tenant-a", projectId: "proj-1", logframeItemId: "item-1",
  code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "100", unit: "people",
});

function period(closed = false) {
  if (closed) return { projectId: "proj-1", status: { value: "CLOSED" } };
  const p = ReportingPeriod.create({
    id: "period-1", tenantId: "tenant-a", projectId: "proj-1", reportType: "MONTHLY",
    startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z"),
    deadline: new Date("2026-09-15T00:00:00Z"),
  });
  return p;
}

function harness({ closed = false, existing = null } = {}) {
  const store = { row: existing, audits: [] };
  const repo = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: store.row }),
    create: async (u) => { store.row = u; return { ok: true, value: u }; },
    update: async (u) => { store.row = u; return { ok: true, value: u }; },
  };
  const audit = { record: async (e) => { store.audits.push(e); return { ok: true, value: undefined }; } };
  const periods = { findById: async () => ({ ok: true, value: period(closed) }) };
  const indicators = {
    findById: async (id) => ({ ok: true, value: id === "ind-1" ? indicator : null }),
    findByProject: async () => ({ ok: true, value: [indicator] }),
  };
  const ids = { generate: () => "upd-1" };
  return {
    store,
    create: new CreateIndicatorUpdateHandler(ids, repo, audit, indicators, periods),
    bulk: new BulkUpsertIndicatorUpdatesHandler(ids, repo, indicators, periods, audit),
  };
}

const base = { indicatorId: "ind-1", reportingPeriodId: "period-1", periodAchievement: "10", cumulativeAchievement: "10", attachedEvidenceIds: [] };
const split = [
  { dimension: "SEX", category: "Female", value: "6" },
  { dimension: "SEX", category: "Male", value: "4" },
];

test("ME-04: a breakdown sent to the single-value path is stored, not dropped", async () => {
  const h = harness();
  const r = await h.create.handle(ctx, { ...base, disaggregation: split });
  assert.equal(r.ok, true);
  assert.deepEqual(h.store.row.disaggregation.map((e) => [e.category, e.value]), [["Female", "6"], ["Male", "4"]]);
});

test("ME-04: a breakdown that does not add up is refused, not silently ignored", async () => {
  const h = harness();
  const r = await h.create.handle(ctx, { ...base, disaggregation: [{ dimension: "SEX", category: "Female", value: "9" }] });
  assert.equal(r.ok, false);
  assert.equal(h.store.row, null);
});

test("single-value path refuses a closed period and a foreign indicator", async () => {
  assert.equal((await harness({ closed: true }).create.handle(ctx, base)).ok, false);
  assert.equal((await harness().create.handle(ctx, { ...base, indicatorId: "other" })).ok, false);
});

function sentBack() {
  const u = IndicatorUpdate.create({
    id: "upd-1", tenantId: "tenant-a", indicatorId: "ind-1", reportingPeriodId: "period-1",
    periodAchievement: "10", cumulativeAchievement: "10", comments: "Counted at the camp", createdById: "user-1",
  });
  u.submit();
  u.requestCorrection("Source document is missing");
  return u;
}

test("ME-12: the reviewer's reason is kept apart from the officer's note and survives a save", async () => {
  const h = harness({ existing: sentBack() });
  assert.equal(h.store.row.comments, "Counted at the camp");
  assert.equal(h.store.row.reviewNote, "Source document is missing");
  await h.bulk.handle(ctx, { reportingPeriodId: "period-1", updates: [{ indicatorId: "ind-1", periodAchievement: "12", cumulativeAchievement: "12", comments: "Recounted" }] });
  assert.equal(h.store.row.comments, "Recounted");
  assert.equal(h.store.row.reviewNote, "Source document is missing");
});

test("ME-12: omitting a note keeps it; an empty string clears it", async () => {
  const h = harness({ existing: sentBack() });
  await h.bulk.handle(ctx, { reportingPeriodId: "period-1", updates: [{ indicatorId: "ind-1", periodAchievement: "11", cumulativeAchievement: "11" }] });
  assert.equal(h.store.row.comments, "Counted at the camp");
  await h.bulk.handle(ctx, { reportingPeriodId: "period-1", updates: [{ indicatorId: "ind-1", periodAchievement: "11", cumulativeAchievement: "11", comments: "" }] });
  assert.equal(h.store.row.comments, undefined);
});

test("ME-12: the edit audit records the value it replaced, and verifying clears the reason", async () => {
  const h = harness({ existing: sentBack() });
  await h.bulk.handle(ctx, { reportingPeriodId: "period-1", updates: [{ indicatorId: "ind-1", periodAchievement: "12", cumulativeAchievement: "12" }] });
  assert.equal(h.store.audits.at(-1).oldValue, "10");
  assert.equal(h.store.audits.at(-1).newValue, "12");
  h.store.row.submit();
  h.store.row.verify("user-2");
  assert.equal(h.store.row.reviewNote, undefined);
});

// --- H-4: approval locks the period's figures ---
for (const status of ["APPROVED", "SUBMITTED", "CLOSED"]) {
  test(`H-4: a ${status} period refuses new and changed figures, and says how to correct them`, async () => {
    const h = harness();
    h.periodStatus = status;
    const locked = { findById: async () => ({ ok: true, value: { projectId: "proj-1", status: { value: status } } }) };
    const create = new CreateIndicatorUpdateHandler({ generate: () => "u" }, { findByIndicatorAndPeriod: async () => ({ ok: true, value: null }), create: async (u) => ({ ok: true, value: u }) }, { record: async () => {} }, { findById: async () => ({ ok: true, value: indicator }), findByProject: async () => ({ ok: true, value: [indicator] }) }, locked);
    const r = await create.handle(ctx, base);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "CONFLICT");
    if (status !== "CLOSED") assert.match(r.error.message, /Reopen the report/);
    const bulk = new BulkUpsertIndicatorUpdatesHandler({ generate: () => "u" }, {}, { findByProject: async () => ({ ok: true, value: [indicator] }) }, locked, { record: async () => {} });
    assert.equal((await bulk.handle(ctx, { reportingPeriodId: "period-1", updates: [{ indicatorId: "ind-1", periodAchievement: "1", cumulativeAchievement: "1" }] })).ok, false);
  });
}

test("H-4: a report still being written is not locked", async () => {
  const { isPeriodLocked } = await import("@donordesk/domain");
  for (const s of ["NOT_STARTED", "IN_PROGRESS", "EVIDENCE_COLLECTION", "DRAFT_GENERATED", "UNDER_REVIEW"]) assert.equal(isPeriodLocked(s), false, s);
});
