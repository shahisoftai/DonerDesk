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

function periodOf(id, reportType, start, end) {
  return ReportingPeriod.create({
    id,
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportType,
    startDate: new Date(start),
    endDate: new Date(end),
    deadline: new Date(new Date(end).getTime() + 7 * 24 * 60 * 60 * 1000),
  });
}

function lifeOfProjectService({ current, periods, updatesByIndicator }) {
  const indicator = makeIndicator();
  const periodsRepo = {
    findById: async () => ({ ok: true, value: current }),
    findByProject: async () => ({ ok: true, value: periods }),
    findPreviousPeriods: async () => ({ ok: true, value: [] }),
  };
  const updatesRepo = {
    findByReportingPeriod: async (id) => ({ ok: true, value: (updatesByIndicator["ind-1"] ?? []).filter((u) => u.reportingPeriodId === id) }),
    findByIndicator: async (id) => ({ ok: true, value: updatesByIndicator[id] ?? [] }),
  };
  return new IndicatorAnalyticsService(periodsRepo, { findByProject: async () => ({ ok: true, value: [indicator] }) }, updatesRepo);
}

test("annual findings carry life-of-project progress from cadence periods up to the report", async () => {
  const q1 = periodOf("q1", "QUARTERLY", "2028-01-01", "2028-03-31");
  const q2 = periodOf("q2", "QUARTERLY", "2028-04-01", "2028-06-30");
  const annual = periodOf("a1", "ANNUAL", "2028-07-01", "2028-12-31");
  const later = periodOf("q9", "QUARTERLY", "2029-01-01", "2029-03-31");
  const adhoc = periodOf("act", "ACTIVITY", "2028-02-01", "2028-02-07");
  const service = lifeOfProjectService({
    current: annual,
    periods: [q1, q2, annual, later, adhoc],
    updatesByIndicator: {
      "ind-1": [
        verifiedUpdate("u1", "ind-1", "q1", "100"),
        verifiedUpdate("u2", "ind-1", "q2", "50"),
        verifiedUpdate("u3", "ind-1", "q9", "999"),
        verifiedUpdate("u4", "ind-1", "act", "777"),
      ],
    },
  });
  const result = await service.computeFindings({ reportingPeriodId: "a1", projectId: "proj-1", tenantId: tenant });
  assert.equal(result.ok, true);
  const finding = result.value[0];
  assert.equal(finding.lifeOfProject?.periodsCovered, 2);
  assert.equal(finding.lifeOfProject?.asOf, "2028-06-30");
  assert.equal(finding.lifeOfProject?.value, "50"); // the recorded cumulative of the latest period (here equal to its period value)
});

test("quarterly findings do not read life-of-project data", async () => {
  const q1 = periodOf("q1", "QUARTERLY", "2028-01-01", "2028-03-31");
  const service = lifeOfProjectService({ current: q1, periods: [q1], updatesByIndicator: {} });
  service.updates.findByIndicator = async () => { throw new Error("must not be called"); };
  const result = await service.computeFindings({ reportingPeriodId: "q1", projectId: "proj-1", tenantId: tenant });
  assert.equal(result.ok, true);
  assert.equal(result.value[0].lifeOfProject, undefined);
});
