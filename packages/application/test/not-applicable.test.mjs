import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { upsertIndicatorUpdate, notApplicableAnswer } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
function repo() {
  const rows = [];
  return {
    rows,
    findByIndicatorAndPeriod: async (i, p) => ok(rows.find((r) => r.indicatorId === i && r.reportingPeriodId === p) ?? null),
    create: async (u) => (rows.push(u), ok(u)),
    update: async (u) => ok(u),
  };
}
let n = 0;
const ids = { generate: () => `u${++n}` };
const save = (r, input) => upsertIndicatorUpdate(ids, r, tenantId, "user", "p1", { indicatorId: "i1", periodAchievement: "", cumulativeAchievement: "", ...input });

test("a reason makes the value 'not applicable': no figure, never 0", async () => {
  const r = repo();
  await save(r, { periodAchievement: "5", cumulativeAchievement: "9", notApplicableReason: " Clinic closed for refurbishment " });
  const u = r.rows[0];
  assert.equal(u.isNotApplicable, true);
  assert.equal(u.notApplicableReason, "Clinic closed for refurbishment");
  assert.equal(u.periodAchievement, "");
  assert.equal(u.cumulativeAchievement, "");
  assert.deepEqual(u.disaggregation, []);
});

test("an omitted answer is kept; a typed figure means it applies after all; an empty reason clears it", async () => {
  const r = repo();
  await save(r, { notApplicableReason: "No distribution this month" });
  await save(r, { comments: "note" });
  assert.equal(r.rows[0].notApplicableReason, "No distribution this month");
  await save(r, { periodAchievement: "12" });
  assert.equal(r.rows[0].isNotApplicable, false);
  assert.equal(r.rows[0].periodAchievement, "12");
  await save(r, { periodAchievement: "", notApplicableReason: "Paused" });
  assert.equal(r.rows[0].isNotApplicable, true);
  await save(r, { notApplicableReason: "" });
  assert.equal(r.rows[0].isNotApplicable, false);
});

test("notApplicableAnswer is pure", () => {
  assert.equal(notApplicableAnswer({ periodAchievement: "", cumulativeAchievement: "", notApplicableReason: "x" }, undefined), "x");
  assert.equal(notApplicableAnswer({ periodAchievement: "", cumulativeAchievement: "" }, "kept"), "kept");
  assert.equal(notApplicableAnswer({ periodAchievement: "3", cumulativeAchievement: "" }, "kept"), undefined);
});

import { Indicator, IndicatorUpdate } from "@donordesk/domain";
import { BulkUpsertIndicatorUpdatesHandler } from "../dist/index.js";

test("a sheet saved over a value someone else changed is refused, naming the indicator; matching versions save", async () => {
  const ind = Indicator.create({ id: "i1", tenantId: "tenant-a", projectId: "p1", logframeItemId: "l1", code: "OUT-1", name: "Out", type: "NUMBER", baseline: "0", target: "100" });
  const stored = IndicatorUpdate.rehydrate({
    id: "x1", tenantId: "tenant-a", createdAt: new Date("2026-10-01T10:00:00Z"), updatedAt: new Date("2026-10-02T09:00:00Z"),
    props: { indicatorId: "i1", reportingPeriodId: "per1", periodAchievement: "5", cumulativeAchievement: "5", attachedEvidenceIds: [], verificationStatus: "DRAFT", createdById: "u" },
  });
  assert.equal(stored.updatedAt.toISOString(), "2026-10-02T09:00:00.000Z");
  const updates = {
    findByReportingPeriod: async () => ok([stored]),
    findByIndicatorAndPeriod: async () => ok(stored),
    update: async (u) => ok(u),
  };
  const period = { projectId: "p1", status: { value: "DRAFTING" }, entryOpensOn: undefined, entryClosesOn: undefined };
  const h = new BulkUpsertIndicatorUpdatesHandler(ids, updates, { findByProject: async () => ok([ind]) }, { findById: async () => ok(period) }, { record: async () => {} });
  const ctx = { tenant: { tenantId, userId: "u", role: "PROJECT_MANAGER" }, requestId: "r" };
  const stale = await h.handle(ctx, { reportingPeriodId: "per1", updates: [{ indicatorId: "i1", periodAchievement: "7", cumulativeAchievement: "7", expectedUpdatedAt: "2026-10-01T10:00:00.000Z" }] });
  assert.equal(stale.ok, false);
  assert.match(stale.error.message, /OUT-1/);
  const fresh = await h.handle(ctx, { reportingPeriodId: "per1", updates: [{ indicatorId: "i1", periodAchievement: "7", cumulativeAchievement: "7", expectedUpdatedAt: "2026-10-02T09:00:00.000Z" }] });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.value.saved, 1);
});
