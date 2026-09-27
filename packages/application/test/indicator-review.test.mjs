import assert from "node:assert/strict";
import test from "node:test";
import {
  ListIndicatorUpdatesHandler,
  RequestIndicatorUpdateCorrectionHandler,
  RejectIndicatorUpdateHandler,
  VerifyIndicatorUpdateHandler,
} from "../dist/index.js";
import { TenantId, Indicator, IndicatorUpdate, ReportingPeriod } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "reviewer-1", role: "ADMIN" }, requestId: "r-1" };

function makeUpdate(id, periodId, createdAt = new Date()) {
  return IndicatorUpdate.rehydrate({
    id,
    tenantId: "tenant-a",
    createdAt,
    props: {
      indicatorId: "ind-1",
      reportingPeriodId: periodId,
      periodAchievement: "5",
      cumulativeAchievement: "5",
      attachedEvidenceIds: [],
      verificationStatus: "SUBMITTED",
      createdById: "user-1",
    },
  });
}

function makePeriod(id, start) {
  const s = new Date(start);
  return ReportingPeriod.create({
    id, tenantId: "tenant-a", projectId: "proj-1", reportType: "QUARTERLY",
    startDate: s, endDate: new Date(s.getTime() + 80 * 864e5), deadline: new Date(s.getTime() + 100 * 864e5),
  });
}

function updateRepo(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    saved: [],
    async findById(id) { return { ok: true, value: byId.get(id) ?? null }; },
    async update(u) { this.saved.push(u); return { ok: true, value: u }; },
    async findByIndicator(indicatorId) { return { ok: true, value: rows.filter((r) => r.indicatorId === indicatorId) }; },
  };
}

function auditLog() {
  return { events: [], async record(e) { this.events.push(e); } };
}

test("request correction transitions, audits old/new status and reason", async () => {
  const repo = updateRepo([makeUpdate("u-1", "p-1")]);
  const audit = auditLog();
  const r = await new RequestIndicatorUpdateCorrectionHandler(repo, audit).handle(ctx, "u-1", { reason: "Check totals" });
  assert.equal(r.ok, true);
  assert.equal(repo.saved[0].verificationStatus, "NEEDS_CORRECTION");
  assert.deepEqual(
    { e: audit.events[0].eventType, o: audit.events[0].oldValue, n: audit.events[0].newValue, note: audit.events[0].systemNote },
    { e: "logframe.indicator.correction_requested", o: "SUBMITTED", n: "NEEDS_CORRECTION", note: "Check totals" },
  );
});

test("invalid transitions return a Result error and write nothing", async () => {
  const repo = updateRepo([makeUpdate("u-1", "p-1")]);
  const audit = auditLog();
  assert.equal((await new VerifyIndicatorUpdateHandler(repo, audit).handle(ctx, "u-1")).ok, true);
  const r = await new RejectIndicatorUpdateHandler(repo, audit).handle(ctx, "u-1", { reason: "late" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(repo.saved.length, 1);
  assert.equal(audit.events.length, 1);
});

test("unknown update id is NOT_FOUND", async () => {
  const r = await new RejectIndicatorUpdateHandler(updateRepo([]), auditLog()).handle(ctx, "missing", { reason: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "NOT_FOUND");
});

test("indicator history is ordered by period start and carries period context", async () => {
  const indicator = Indicator.create({
    id: "ind-1", tenantId: "tenant-a", projectId: "proj-1", logframeItemId: "item-1",
    code: "I1", name: "Indicator", type: "NUMBER", baseline: "0", target: "10",
  });
  const indicators = { async findById(id) { return { ok: true, value: id === "ind-1" ? indicator : null }; } };
  const periods = { async findByProject() { return { ok: true, value: [makePeriod("p-late", "2026-07-01"), makePeriod("p-early", "2026-01-01")] }; } };
  const repo = updateRepo([makeUpdate("u-late", "p-late"), makeUpdate("u-early", "p-early"), makeUpdate("u-orphan", "p-gone")]);
  const r = await new ListIndicatorUpdatesHandler(indicators, repo, periods).handle(ctx, "ind-1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.updates.map((u) => u.id), ["u-early", "u-late", "u-orphan"]);
  assert.equal(r.value.updates[0].periodReportType, "QUARTERLY");
  assert.equal(r.value.updates[2].periodStart, null);
  const missing = await new ListIndicatorUpdatesHandler(indicators, repo, periods).handle(ctx, "nope");
  assert.equal(missing.ok, false);
});
