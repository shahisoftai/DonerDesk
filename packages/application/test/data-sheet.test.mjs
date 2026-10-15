import assert from "node:assert/strict";
import test from "node:test";
import { GetProjectDataSheetHandler, ImportDataSheetHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const period = (id, start, end, status = "OPEN", reportType = "MONTHLY") => ({ id, reportType, duration: { start: new Date(start), end: new Date(end) }, status: { value: status } });
const periods = [period("p1", "2026-01-01", "2026-03-31", "OPEN", "QUARTERLY"), period("p2", "2026-04-01", "2026-04-30", "CLOSED")];
const update = (indicatorId, reportingPeriodId, a, c) => ({ indicatorId, reportingPeriodId, periodAchievement: a, cumulativeAchievement: c, verificationStatus: "DRAFT" });
const summary = { view: () => ({ currency: "USD", budget: "1000", expenditure: "250", balance: "750", burnRatePercent: "25.0" }), isVerified: false };

function get({ financeMode = "DISABLED" } = {}) {
  return new GetProjectDataSheetHandler(
    { findByProject: async () => ok(periods) },
    { findByProject: async () => ok([{ id: "L1", level: "OUTPUT" }]) },
    { findByProject: async () => ok([{ id: "i1", code: "OUT-1", name: "Trained", type: "COUNT", unit: "people", baseline: "0", target: "100", logframeItemId: "L1" }]) },
    { findByReportingPeriods: async () => ok([update("i1", "p1", "10", "10"), update("gone", "p1", "9", "9")]) },
    { modeFor: async () => ok(financeMode) },
    { findByPeriod: async (id) => ok(id === "p1" ? summary : null) },
  );
}

test("the sheet lists periods oldest first, marks closed ones, and drops values of archived indicators", async () => {
  const r = await get().handle(ctx, "proj");
  assert.deepEqual(r.value.periods.map((p) => [p.label, p.locked]), [["1 Jan 2026 – 31 Mar 2026", false], ["Apr 2026", true]]);
  assert.equal(r.value.cells.length, 1);
  assert.equal(r.value.indicators[0].level, "OUTPUT");
});

test("finance figures appear only when the project's finance mode is on (and only for quarterly-or-longer periods), and carry their verification", async () => {
  assert.deepEqual((await get().handle(ctx, "proj")).value.finance, []);
  const on = await get({ financeMode: "TYPED" }).handle(ctx, "proj");
  assert.equal(on.value.financeEnabled, true);
  assert.equal(on.value.finance.length, 1);
  assert.equal(on.value.finance[0].verified, false);
});

test("import: a preview saves nothing; applying saves changed rows per period; a bad row blocks everything", async () => {
  const saved = [];
  const imp = new ImportDataSheetHandler(get(), { handle: async (_c, input) => { saved.push(input); return ok({ saved: input.updates.length, skipped: 0, updates: [] }); } });
  const table = [["Indicator code", "Period", "Period value"], ["OUT-1", "1 Jan 2026 – 31 Mar 2026", "12"]];
  const preview = await imp.handle(ctx, "proj", table, false);
  assert.equal(preview.value.preview.changed, 1);
  assert.equal(saved.length, 0);
  const applied = await imp.handle(ctx, "proj", table, true);
  assert.equal(applied.value.saved, 1);
  assert.deepEqual(saved[0], { reportingPeriodId: "p1", updates: [{ indicatorId: "i1", periodAchievement: "12", cumulativeAchievement: "10" }] });

  saved.length = 0;
  const bad = await imp.handle(ctx, "proj", [...table, ["OUT-1", "Apr 2026", "5"]], true);
  assert.equal(bad.ok, false);
  assert.equal(saved.length, 0);
});
