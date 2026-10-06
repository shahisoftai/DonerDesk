import assert from "node:assert/strict";
import test from "node:test";
import {
  computeIndicator,
  findingStatus,
  isReportedFinding,
  partitionFindings,
  frequencyIntervalMonths,
  isDueInPeriod,
  expectedInPeriod,
} from "../dist/index.js";

const semantics = (aggregation = "SUM") => ({ aggregation, direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" });
const update = (over = {}) => ({ id: "u", periodAchievement: "10", cumulativeAchievement: "10", verificationStatus: "VERIFIED", updatedAt: new Date(), ...over });
const compute = (updates, aggregation = "SUM", extra = {}) =>
  computeIndicator({ indicatorId: "i", indicatorCode: "C1", indicatorType: "NUMBER", semantics: semantics(aggregation), disaggregationRequired: false, updates, ...extra });

test("status table: (updates, verified, aggregation) -> status", () => {
  const cases = [
    ["no update", [], "SUM", "NOT_MEASURED"],
    ["only unverified", [update({ verificationStatus: "PENDING" })], "SUM", "UNVERIFIED"],
    ["verified numeric", [update()], "SUM", "REPORTED"],
    ["verified numeric, latest", [update()], "LATEST", "REPORTED"],
    ["verified but blank value", [update({ periodAchievement: " " })], "SUM", "NOT_MEASURED"],
    ["verified but non-numeric", [update({ periodAchievement: "n/a" })], "AVERAGE", "NOT_MEASURED"],
    ["verified zero is a real zero", [update({ periodAchievement: "0" })], "SUM", "REPORTED"],
  ];
  for (const [name, updates, aggregation, expected] of cases) {
    assert.equal(compute(updates, aggregation).status, expected, name);
  }
});

test("ratio without a denominator is not measured", () => {
  const finding = compute([update()], "RATIO", { numeratorValues: ["1"], denominatorValues: [] });
  assert.equal(finding.status, "NOT_MEASURED");
  assert.ok(finding.qualityFlags.includes("MISSING_DENOMINATOR"));
  assert.equal(compute([update()], "PERCENTAGE", { numeratorValues: ["1"], denominatorValues: ["4"] }).status, "REPORTED");
});

test("property: no recorded value never yields a reported finding", () => {
  const statuses = ["PENDING", "REJECTED", "DRAFT", "VERIFIED"];
  const values = ["", " ", "x", "n/a"];
  for (const aggregation of ["SUM", "AVERAGE", "LATEST", "MIN", "MAX"]) {
    for (const s of statuses) for (const v of values) {
      const finding = compute([update({ verificationStatus: s, periodAchievement: v, cumulativeAchievement: v })], aggregation);
      assert.notEqual(finding.status, "REPORTED", `${aggregation}/${s}/${JSON.stringify(v)}`);
    }
  }
});

test("a snapshot persisted before the field is read as reported; partition splits", () => {
  assert.equal(findingStatus({}), "REPORTED");
  assert.equal(isReportedFinding({ status: "UNVERIFIED" }), false);
  const { reported, withoutFigure } = partitionFindings([{ status: "REPORTED" }, { status: "NOT_MEASURED" }, {}]);
  assert.equal(reported.length, 2);
  assert.equal(withoutFigure.length, 1);
});

test("frequency text -> interval months; unknown text means every period", () => {
  const table = [["quarterly", 3], ["Quarterly survey", 3], ["Every 6 months", 6], ["semi-annual", 6], ["Annual", 12], ["yearly", 12], ["baseline & endline", 12], ["monthly", 1], ["per activity", 1], ["", 1], [undefined, 1]];
  for (const [text, months] of table) assert.equal(frequencyIntervalMonths(text), months, String(text));
});

test("a quarterly indicator is due in quarter-closing months only; values and the final period always count", () => {
  const projectStart = new Date(Date.UTC(2026, 0, 1));
  const end = (m) => new Date(Date.UTC(2026, m, 28));
  const due = (m, extra = {}) => isDueInPeriod("quarterly", { projectStart, periodEnd: end(m) }, extra);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((m) => due(m)), [false, false, true, false, false, true]);
  assert.equal(due(4, { isFinalPeriod: true }), true);
  assert.equal(expectedInPeriod({ frequency: "quarterly", window: { projectStart, periodEnd: end(1) }, hasValue: true }), true);
  assert.equal(expectedInPeriod({ frequency: "quarterly", window: { projectStart, periodEnd: end(1) }, hasValue: false }), false);
  assert.equal(isDueInPeriod("monthly", { projectStart, periodEnd: end(1) }), true);
});
