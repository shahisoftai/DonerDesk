import assert from "node:assert/strict";
import test from "node:test";
import { VerifyIndicatorUpdateHandler, VerifyPeriodIndicatorUpdatesHandler, VerificationEvidencePolicy } from "../dist/index.js";
import { TenantId, IndicatorUpdate, Indicator, ReportingPeriod } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1", role: "ME_OFFICER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

const indicator = Indicator.create({ id: "ind-1", tenantId: "tenant-a", projectId: "proj-1", logframeItemId: "i", code: "IND-1", name: "x", type: "NUMBER", baseline: "0", target: "10" });
const update = (id, evidence = []) => IndicatorUpdate.create({ id, tenantId: "tenant-a", indicatorId: "ind-1", reportingPeriodId: "per-1", periodAchievement: "5", cumulativeAchievement: "5", attachedEvidenceIds: evidence, createdById: "u0" });

function world(required) {
  const rows = new Map([["a", update("a")], ["b", update("b", ["ev-1"])]]);
  const repo = { findById: async (id) => ok(rows.get(id) ?? null), update: async (u) => ok(u), findByReportingPeriod: async () => ok([...rows.values()]) };
  const policy = new VerificationEvidencePolicy(
    { findById: async () => ok(indicator), findByProject: async () => ok([indicator]) },
    { findByProject: async () => ok({ requireEvidenceForVerification: required }) },
  );
  const audits = [];
  const audit = { record: async (e) => { audits.push(e.eventType); } };
  const period = ReportingPeriod.create({ id: "per-1", tenantId: "tenant-a", projectId: "proj-1", reportType: "MONTHLY", startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z"), deadline: new Date("2026-09-15T00:00:00Z") });
  return {
    rows, audits,
    single: new VerifyIndicatorUpdateHandler(repo, audit, policy),
    period: new VerifyPeriodIndicatorUpdatesHandler(repo, { findByProject: async () => ok([indicator]) }, { findById: async () => ok(period) }, { findByReportingPeriod: async () => ok([]), findByProject: async () => ok([]), listByProject: async () => ok([]) }, audit, policy),
  };
}

test("ME-09: with the setting off, a value verifies without a file (as before)", async () => {
  const w = world(false);
  assert.equal((await w.single.handle(ctx, "a")).ok, true);
  assert.equal(w.rows.get("a").verificationStatus, "VERIFIED");
});

test("ME-09: with it on, a value with no file is refused in plain words; one with a file verifies", async () => {
  const w = world(true);
  const refused = await w.single.handle(ctx, "a");
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /Attach a file that proves this value/);
  assert.notEqual(w.rows.get("a").verificationStatus, "VERIFIED");
  assert.equal((await w.single.handle(ctx, "b")).ok, true);
  assert.equal(w.rows.get("b").verificationStatus, "VERIFIED");
});

test("ME-09: 'verify all' verifies the rows that have a file and names the ones that do not", async () => {
  const w = world(true);
  const r = await w.period.handle(ctx, { reportingPeriodId: "per-1" });
  assert.equal(r.ok, true, r.ok ? "" : r.error.message);
  assert.equal(r.value.verified, 1);
  assert.deepEqual(r.value.failed.map((f) => [f.updateId, f.indicatorCode]), [["a", "IND-1"]]);
  assert.match(r.value.failed[0].message, /Attach a file/);
});

test("ME-09: a missing profile or a missing deployment policy means no requirement", async () => {
  const none = new VerificationEvidencePolicy({ findById: async () => ok(indicator) }, { findByProject: async () => ok(null) });
  assert.equal(await none.requiredForIndicator("ind-1", tenantId), false);
  assert.equal(await none.requiredForProject("proj-1", tenantId), false);
});
