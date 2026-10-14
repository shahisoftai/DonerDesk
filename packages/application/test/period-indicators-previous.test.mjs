import assert from "node:assert/strict";
import test from "node:test";
import { ListPeriodIndicatorsHandler } from "../dist/index.js";
import { Indicator, ReportingPeriod, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const month = (id, m) => ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "p", reportType: "MONTHLY", startDate: new Date(Date.UTC(2027, m, 1)), endDate: new Date(Date.UTC(2027, m + 1, 0)), deadline: new Date(Date.UTC(2027, m + 1, 10)) });
const ind = Indicator.create({ id: "i1", tenantId: "tenant-a", projectId: "p", logframeItemId: "item", code: "OUT-1", name: "Number of people trained", type: "NUMBER", baseline: "0", target: "100" });

test("each row carries last period's value and how the indicator adds up; later and cancelled-out periods are not used", async () => {
  const periods = [month("jan", 0), month("feb", 1), month("mar", 2)];
  const recorded = [
    { indicatorId: "i1", reportingPeriodId: "jan", periodAchievement: "10", cumulativeAchievement: "10", dataSource: "Register" },
    { indicatorId: "i1", reportingPeriodId: "feb", periodAchievement: "20", cumulativeAchievement: "30", dataSource: "Clinic log" },
    { indicatorId: "i1", reportingPeriodId: "mar", periodAchievement: "99", cumulativeAchievement: "99" },
  ];
  let asked;
  const handler = new ListPeriodIndicatorsHandler(
    { findById: async (id) => ok(periods.find((p) => p.id === id)), findByProject: async () => ok(periods) },
    { findByProject: async () => ok([]) },
    { findByProject: async () => ok([ind]) },
    { findByReportingPeriod: async () => ok([]), findByReportingPeriods: async (ids) => { asked = ids; return ok(recorded.filter((r) => ids.includes(r.reportingPeriodId))); } },
  );
  const out = await handler.handle(ctx, "mar");
  assert.equal(out.ok, true);
  const row = out.value.indicators[0];
  assert.deepEqual([...asked].sort(), ["feb", "jan"]);
  assert.equal(row.previous.periodAchievement, "20");
  assert.equal(row.previous.cumulativeAchievement, "30");
  assert.equal(row.previous.dataSource, "Clinic log");
  assert.equal(row.previous.periodEnd, "2027-02-28");
  assert.equal(row.aggregation, "SUM");
});

test("the first period has no previous value", async () => {
  const periods = [month("jan", 0)];
  const handler = new ListPeriodIndicatorsHandler(
    { findById: async () => ok(periods[0]), findByProject: async () => ok(periods) },
    { findByProject: async () => ok([]) },
    { findByProject: async () => ok([ind]) },
    { findByReportingPeriod: async () => ok([]), findByReportingPeriods: async (ids) => { assert.deepEqual(ids, []); return ok([]); } },
  );
  const out = await handler.handle(ctx, "jan");
  assert.equal(out.value.indicators[0].previous, undefined);
});
