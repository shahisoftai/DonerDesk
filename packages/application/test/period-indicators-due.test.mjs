import assert from "node:assert/strict";
import test from "node:test";
import { ListPeriodIndicatorsHandler } from "../dist/index.js";
import { Indicator, ReportingPeriod, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const indicator = (id, frequency) => Indicator.create({ id, tenantId: "tenant-a", projectId: "p", logframeItemId: "item", code: id, name: id, type: "NUMBER", baseline: "0", target: "10", frequency });
const month = (id, type, m) => ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "p", reportType: type, startDate: new Date(Date.UTC(2026, m, 1)), endDate: new Date(Date.UTC(2026, m + 1, 0)), deadline: new Date(Date.UTC(2026, m + 1, 10)) });

function handler(period, indicators, updates = []) {
  return new ListPeriodIndicatorsHandler(
    { findById: async () => ok(period) },
    { findByProject: async () => ok([]) },
    { findByProject: async () => ok(indicators) },
    { findByReportingPeriod: async () => ok(updates) },
    undefined,
    { findById: async () => ok({ duration: { start: new Date(Date.UTC(2026, 0, 1)) } }) },
  );
}
const dueOf = async (period, indicators, updates) => Object.fromEntries((await handler(period, indicators, updates).handle(ctx, period.id)).value.indicators.map((r) => [r.id, r.dueThisPeriod]));

test("a quarterly indicator is due in quarter-closing months only; monthly and unspecified always (25.2)", async () => {
  const set = [indicator("q", "Quarterly"), indicator("m", "Monthly"), indicator("none", undefined)];
  assert.deepEqual(await dueOf(month("feb", "MONTHLY", 1), set), { q: false, m: true, none: true });
  assert.deepEqual(await dueOf(month("mar", "MONTHLY", 2), set), { q: true, m: true, none: true });
});

test("a recorded value is always expected, and the final period asks for everything", async () => {
  const set = [indicator("q", "Quarterly")];
  const recorded = [{ indicatorId: "q", id: "u1", periodAchievement: "3", cumulativeAchievement: "3", verificationStatus: "DRAFT", attachedEvidenceIds: [], disaggregation: [], comments: undefined, dataSource: undefined, createdAt: new Date(), updatedAt: new Date() }];
  assert.equal((await dueOf(month("feb", "MONTHLY", 1), set, recorded)).q, true);
  assert.equal((await dueOf(month("feb", "FINAL", 1), set)).q, true);
});
