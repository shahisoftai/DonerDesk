import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfirmIndicatorSemanticsHandler,
  VerifyPeriodIndicatorUpdatesHandler,
  BulkUpsertIndicatorUpdatesHandler,
  CreateIndicatorHandler,
} from "../dist/index.js";
import { TenantId, Indicator, IndicatorUpdate, ReportingPeriod } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u-1", role: "ADMIN" }, requestId: "r-1" };
const audit = () => ({ events: [], async record(e) { this.events.push(e); } });

function ind(id, over = {}) {
  return Indicator.create({ id, tenantId: "tenant-a", projectId: "p-1", logframeItemId: "o-1", code: id.toUpperCase(), name: "Widgets", type: "NUMBER", baseline: "0", target: "10", ...over });
}
function indRepo(list) {
  const m = new Map(list.map((i) => [i.id, i]));
  return {
    async findById(id) { return { ok: true, value: m.get(id) ?? null }; },
    async findByProject() { return { ok: true, value: [...m.values()] }; },
    async update(i) { m.set(i.id, i); return { ok: true, value: i }; },
    async create(i) { m.set(i.id, i); return { ok: true, value: i }; },
  };
}

test("confirm stores the effective semantics as CONFIGURED, keeps direction NEUTRAL, audits", async () => {
  const repo = indRepo([ind("i-1")]);
  const a = audit();
  const r = await new ConfirmIndicatorSemanticsHandler(repo, a).handle(ctx, { indicatorIds: ["i-1", "i-1"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.confirmed, ["i-1"]);
  const stored = (await repo.findById("i-1")).value.semantics;
  assert.deepEqual({ s: stored.status, d: stored.direction, a: stored.aggregation }, { s: "CONFIGURED", d: "NEUTRAL", a: "SUM" });
  assert.equal(a.events.length, 1);
  assert.equal(a.events[0].eventType, "logframe.indicator.semantics_confirmed");
});

test("confirm is idempotent for an already configured indicator (no second audit)", async () => {
  const repo = indRepo([ind("i-1")]);
  const a = audit();
  const h = new ConfirmIndicatorSemanticsHandler(repo, a);
  await h.handle(ctx, { indicatorIds: ["i-1"] });
  const r = await h.handle(ctx, { indicatorIds: ["i-1"] });
  assert.deepEqual(r.value.confirmed, ["i-1"]);
  assert.equal(a.events.length, 1);
});

test("confirm refuses a calculated ratio without numerator/denominator, others still confirmed", async () => {
  const repo = indRepo([ind("i-ratio", { type: "RATIO" }), ind("i-2")]);
  const r = await new ConfirmIndicatorSemanticsHandler(repo, audit()).handle(ctx, { indicatorIds: ["i-ratio", "i-2", "nope"] });
  assert.deepEqual(r.value.confirmed, ["i-2"]);
  assert.deepEqual(r.value.failed.map((f) => [f.indicatorId, f.code]), [["i-ratio", "VALIDATION"], ["nope", "NOT_FOUND"]]);
  assert.match(r.value.failed[0].message, /choose its calculation/);
});

test("a percentage without a pair is confirmable as a directly reported latest value", async () => {
  const repo = indRepo([ind("i-pct", { type: "PERCENTAGE" })]);
  const r = await new ConfirmIndicatorSemanticsHandler(repo, audit()).handle(ctx, { indicatorIds: ["i-pct"] });
  assert.deepEqual(r.value.confirmed, ["i-pct"]);
  assert.equal((await repo.findById("i-pct")).value.semantics.aggregation, "LATEST");
});

test("create indicator returns the effective semantics and a description", async () => {
  const repo = indRepo([]);
  const r = await new CreateIndicatorHandler({ generate: () => "i-new" }, repo, audit()).handle(ctx, {
    projectId: "p-1", logframeItemId: "o-1", code: "I-1", name: "Attendance rate", type: "PERCENTAGE", baseline: "", target: "", disaggregationRequired: false,
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.semantics.aggregation, "LATEST");
  assert.equal(r.value.semanticsDescription.needsReview, true);
});

function update(id, indicatorId, status) {
  return IndicatorUpdate.rehydrate({ id, tenantId: "tenant-a", createdAt: new Date(), props: { indicatorId, reportingPeriodId: "rp-1", periodAchievement: "5", cumulativeAchievement: "5", attachedEvidenceIds: [], verificationStatus: status, createdById: "u-2" } });
}
function period(status) {
  const p = ReportingPeriod.create({ id: "rp-1", tenantId: "tenant-a", projectId: "p-1", reportType: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), deadline: new Date("2026-04-30") });
  return p;
}
function updRepo(rows) {
  const m = new Map(rows.map((r) => [r.id, r]));
  return {
    async findById(id) { return { ok: true, value: m.get(id) ?? null }; },
    async update(u) { m.set(u.id, u); return { ok: true, value: u }; },
    async findByReportingPeriod() { return { ok: true, value: [...m.values()] }; },
  };
}
const periods = (p) => ({ async findById() { return { ok: true, value: p }; } });

test("verify-all verifies every unverified update, skips verified, reports per-row failures", async () => {
  const rows = [update("u-a", "i-1", "DRAFT"), update("u-b", "i-2", "VERIFIED"), update("u-c", "i-1", "REJECTED")];
  const repo = updRepo(rows);
  const a = audit();
  const h = new VerifyPeriodIndicatorUpdatesHandler(repo, indRepo([ind("i-1"), ind("i-2")]), periods(period()), undefined, a);
  const r = await h.handle(ctx, { reportingPeriodId: "rp-1" });
  assert.equal(r.ok, true);
  assert.equal(r.value.verified + r.value.failed.length, 2);
  assert.equal((await repo.findById("u-a")).value.verificationStatus, "VERIFIED");
  assert.equal(r.value.failed.every((f) => f.indicatorCode === "I-1"), true);
  assert.equal(a.events.length, r.value.verified);
});

test("verify-all honours an explicit id list and a missing period is NOT_FOUND", async () => {
  const rows = [update("u-a", "i-1", "DRAFT"), update("u-d", "i-1", "DRAFT")];
  const repo = updRepo(rows);
  const h = new VerifyPeriodIndicatorUpdatesHandler(repo, indRepo([ind("i-1")]), periods(period()), undefined, audit());
  const r = await h.handle(ctx, { reportingPeriodId: "rp-1", updateIds: ["u-d"] });
  assert.equal(r.value.verified, 1);
  assert.equal((await repo.findById("u-a")).value.verificationStatus, "DRAFT");
  const none = await new VerifyPeriodIndicatorUpdatesHandler(repo, indRepo([]), periods(null), undefined, audit()).handle(ctx, { reportingPeriodId: "x" });
  assert.equal(none.error.code, "NOT_FOUND");
});

test("bulk save returns one {indicatorId, updateId, changed} per accepted row", async () => {
  const created = [];
  const repo = {
    async findByIndicatorAndPeriod() { return { ok: true, value: null }; },
    async create(u) { created.push(u); return { ok: true, value: u }; },
  };
  let n = 0;
  const h = new BulkUpsertIndicatorUpdatesHandler({ generate: () => `u-${++n}` }, repo, indRepo([ind("i-1"), ind("i-2")]), periods(period()), audit());
  const r = await h.handle(ctx, { reportingPeriodId: "rp-1", updates: [
    { indicatorId: "i-1", periodAchievement: "3", cumulativeAchievement: "3" },
    { indicatorId: "i-2", periodAchievement: "4", cumulativeAchievement: "4" },
    { indicatorId: "unknown", periodAchievement: "1", cumulativeAchievement: "1" },
  ] });
  assert.equal(r.ok, true);
  assert.equal(r.value.saved, 2);
  assert.deepEqual(r.value.updates, [
    { indicatorId: "i-1", updateId: "u-1", changed: true },
    { indicatorId: "i-2", updateId: "u-2", changed: true },
  ]);
});
