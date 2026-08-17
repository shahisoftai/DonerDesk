import assert from "node:assert/strict";
import test from "node:test";
import { IndicatorAnalyticsService } from "../dist/index.js";
import { Indicator, ReportingPeriod, IndicatorUpdate, TenantId } from "@donordesk/domain";

function makeIndicator(id = "ind-1", code = "IND-1") {
  return Indicator.create({
    id,
    tenantId: "tenant-a",
    projectId: "proj-1",
    logframeItemId: "item-1",
    code,
    name: `Indicator ${code}`,
    type: "NUMBER",
    baseline: "0",
    target: "100",
    unit: "people",
  });
}

function verifiedUpdate(id, indicatorId, period, value) {
  const u = makeUpdate(id, indicatorId, period, value);
  u.submit();
  u.verify("user-1");
  return u;
}

function makeUpdate(id, indicatorId, period, value) {
  return IndicatorUpdate.create({
    id,
    tenantId: "tenant-a",
    indicatorId,
    reportingPeriodId: period,
    periodAchievement: value,
    cumulativeAchievement: value,
    createdById: "user-1",
  });
}

function makePeriod(id, start) {
  return ReportingPeriod.create({
    id,
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportType: "MONTHLY",
    startDate: new Date(start),
    endDate: new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000),
    deadline: new Date(new Date(start).getTime() + 60 * 24 * 60 * 60 * 1000),
  });
}

const tenant = TenantId.create("tenant-a");

test("IndicatorAnalyticsService computes verified findings and period-on-period deltas", async () => {
  const current = makePeriod("period-2", "2026-08-01");
  const previous = makePeriod("period-1", "2026-07-01");
  const indicator = makeIndicator();
  const u2 = verifiedUpdate("u2", "ind-1", "period-2", "40");
  const u1 = verifiedUpdate("u1", "ind-1", "period-1", "30");

  const periodsRepo = {
    findById: async () => ({ ok: true, value: current }),
    findPreviousPeriods: async () => ({ ok: true, value: [previous] }),
  };
  const indicatorsRepo = {
    findByProject: async () => ({ ok: true, value: [indicator] }),
  };
  const updatesRepo = {
    findByReportingPeriod: async (periodId) =>
      periodId === "period-2"
        ? { ok: true, value: [u2] }
        : periodId === "period-1"
          ? { ok: true, value: [u1] }
          : { ok: true, value: [] },
  };

  const service = new IndicatorAnalyticsService(periodsRepo, indicatorsRepo, updatesRepo);
  const result = await service.computeFindings({ reportingPeriodId: "period-2", projectId: "proj-1", tenantId: tenant });
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.length === 1);
  const finding = result.ok ? result.value[0] : null;
  assert.equal(finding?.indicatorId, "ind-1");
  assert.equal(finding?.reportingPeriodId, "period-2");
  assert.equal(finding?.value, "40");
  assert.equal(finding?.comparisonPeriodId, "period-1");
  assert.ok(finding?.sourceRecordIds.includes("u2"));
  assert.equal(finding?.qualityFlags.includes("LOW_COVERAGE"), false);
});

test("IndicatorAnalyticsService returns empty findings for a project with no indicators", async () => {
  const current = makePeriod("period-2", "2026-08-01");
  const service = new IndicatorAnalyticsService(
    { findById: async () => ({ ok: true, value: current }), findPreviousPeriods: async () => ({ ok: true, value: [] }) },
    { findByProject: async () => ({ ok: true, value: [] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: [] }) },
  );
  const result = await service.computeFindings({ reportingPeriodId: "period-2", projectId: "proj-1", tenantId: tenant });
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.value.length === 0);
});

test("IndicatorAnalyticsService respects conservative inference when semantics are absent", async () => {
  const current = makePeriod("period-2", "2026-08-01");
  const indicator = Indicator.create({
    id: "ind-2",
    tenantId: "tenant-a",
    projectId: "proj-1",
    logframeItemId: "item-1",
    code: "IND-2",
    name: "Beneficiaries reached",
    type: "NUMBER",
    baseline: "0",
    target: "500",
    unit: "people",
  });
  const u = verifiedUpdate("u9", "ind-2", "period-2", "200");

  const service = new IndicatorAnalyticsService(
    { findById: async () => ({ ok: true, value: current }), findPreviousPeriods: async () => ({ ok: true, value: [] }) },
    { findByProject: async () => ({ ok: true, value: [indicator] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: [u] }) },
  );
  const result = await service.computeFindings({ reportingPeriodId: "period-2", projectId: "proj-1", tenantId: tenant });
  assert.ok(result.ok);
  const finding = result.ok ? result.value[0] : null;
  assert.equal(finding?.indicatorCode, "IND-2");
  assert.equal(finding?.value, "200");
});
