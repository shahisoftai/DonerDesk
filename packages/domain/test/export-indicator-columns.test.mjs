import test from "node:test";
import assert from "node:assert/strict";
import { indicatorExportCell, indicatorExportColumns, indicatorExportRow, percentOfTarget } from "../dist/index.js";

const safeWater = { code: "IND1", name: "People with safe water", baseline: "0", target: "14000", unit: "people", type: "NUMBER" };
const update = { periodAchievement: "2800", cumulativeAchievement: "14000", verificationStatus: "VERIFIED" };

test("a monthly report keeps today's columns and values exactly (golden)", () => {
  const row = indicatorExportRow({ reportType: "MONTHLY", indicator: safeWater, update });
  assert.deepEqual(row, { code: "IND1", name: "People with safe water", baseline: "0", target: "14000", unit: "people", status: "VERIFIED", achievement: "2800" });
  assert.deepEqual(indicatorExportColumns([row]).map((c) => c.header), ["Code", "Indicator", "Baseline", "Target", "Achievement", "Unit", "Status"]);
  assert.equal(indicatorExportRow({ reportType: "MONTHLY", indicator: safeWater }).achievement, "0", "monthly: a missing value reads 0, as before");
});

test("a final report shows 14,000 (life of project) beside 2,800 (August) and the percentage of target", () => {
  const row = indicatorExportRow({ reportType: "FINAL", indicator: safeWater, update });
  assert.equal(row.periodValue, "2800");
  assert.equal(row.lifeOfProjectValue, "14000");
  assert.equal(row.percentOfTarget, "100%");
  const cols = indicatorExportColumns([row]);
  assert.deepEqual(cols.map((c) => c.header), ["Code", "Indicator", "Baseline", "Target", "This period", "Life of project to date", "% of target", "Unit", "Status"]);
  assert.deepEqual(cols.map((c) => indicatorExportCell(row, c.key)), ["IND1", "People with safe water", "0", "14000", "2800", "14000", "100%", "people", "VERIFIED"]);
});

test("roll-ups: a rate stands for itself, a missing value stays empty (never 0), no target gives no percentage", () => {
  const rate = indicatorExportRow({ reportType: "ANNUAL", indicator: { ...safeWater, type: "PERCENTAGE", target: "80", unit: "%" }, update: { periodAchievement: "76", cumulativeAchievement: "", verificationStatus: "VERIFIED" } });
  assert.equal(rate.lifeOfProjectValue, "76");
  assert.equal(rate.percentOfTarget, "95%");
  const missing = indicatorExportRow({ reportType: "SEMI_ANNUAL", indicator: safeWater });
  assert.equal(missing.periodValue, "");
  assert.equal(missing.lifeOfProjectValue, "");
  assert.equal(missing.percentOfTarget, "");
  assert.equal(indicatorExportRow({ reportType: "FINAL", indicator: { ...safeWater, target: "" }, update }).percentOfTarget, "");
});

test("percent of target handles commas, zero and missing targets", () => {
  assert.equal(percentOfTarget("7,000", "14,000"), "50%");
  assert.equal(percentOfTarget("5", "0"), "");
  assert.equal(percentOfTarget("", "10"), "");
  assert.equal(percentOfTarget("5", undefined), "");
});
