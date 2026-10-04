import test from "node:test";
import assert from "node:assert/strict";
import { computeLifeOfProject, LIFE_OF_PROJECT_REPORT_TYPES } from "../dist/index.js";

const sum = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
const u = (periodId, end, period, cumulative = "", status = "VERIFIED") => ({
  periodId,
  periodEnd: new Date(`${end}T00:00:00Z`),
  periodAchievement: period,
  cumulativeAchievement: cumulative,
  verificationStatus: status,
});

test("applies to semi-annual, annual and final reports only", () => {
  assert.deepEqual([...LIFE_OF_PROJECT_REPORT_TYPES].sort(), ["ANNUAL", "FINAL", "SEMI_ANNUAL"]);
});

test("a recorded cumulative from the latest period is authoritative for SUM", () => {
  const r = computeLifeOfProject(sum, [u("p1", "2028-03-31", "100", "100"), u("p2", "2028-06-30", "150", "260")]);
  assert.deepEqual(r, { value: "260", basis: "REPORTED_CUMULATIVE", periodsCovered: 2, asOf: "2028-06-30" });
});

test("SUM without recorded cumulatives adds verified period values", () => {
  const r = computeLifeOfProject(sum, [u("p1", "2028-03-31", "100"), u("p2", "2028-06-30", "150"), u("p2", "2028-06-30", "10")]);
  assert.deepEqual(r, { value: "260", basis: "COMPUTED", periodsCovered: 2, asOf: "2028-06-30" });
});

test("unverified updates never count", () => {
  assert.equal(computeLifeOfProject(sum, [u("p1", "2028-03-31", "100", "100", "DRAFT")]), null);
  const r = computeLifeOfProject(sum, [u("p1", "2028-03-31", "100"), u("p2", "2028-06-30", "999", "999", "SUBMITTED")]);
  assert.equal(r?.value, "100");
});

test("LATEST, AVERAGE, MIN and MAX aggregate period values", () => {
  const ups = [u("p1", "2028-03-31", "10"), u("p2", "2028-06-30", "30"), u("p3", "2028-09-30", "20")];
  const run = (aggregation) => computeLifeOfProject({ ...sum, aggregation }, ups)?.value;
  assert.equal(run("LATEST"), "20");
  assert.equal(run("AVERAGE"), "20");
  assert.equal(run("MIN"), "10");
  assert.equal(run("MAX"), "30");
});

test("a recorded cumulative does not override a non-SUM period aggregation", () => {
  const r = computeLifeOfProject({ ...sum, aggregation: "MAX" }, [u("p1", "2028-03-31", "10", "500"), u("p2", "2028-06-30", "30", "900")]);
  assert.deepEqual(r, { value: "30", basis: "COMPUTED", periodsCovered: 2, asOf: "2028-06-30" });
});

test("CUMULATIVE-basis indicators use the latest recorded cumulative", () => {
  const r = computeLifeOfProject({ ...sum, aggregation: "LATEST", reportingBasis: "CUMULATIVE" }, [u("p1", "2028-03-31", "10", "10"), u("p2", "2028-06-30", "5", "15")]);
  assert.equal(r?.value, "15");
  assert.equal(r?.basis, "REPORTED_CUMULATIVE");
});

test("ratios, percentages, text and empty values have no life-of-project figure", () => {
  assert.equal(computeLifeOfProject({ ...sum, aggregation: "PERCENTAGE" }, [u("p1", "2028-03-31", "50")]), null);
  assert.equal(computeLifeOfProject({ ...sum, aggregation: "RATIO" }, [u("p1", "2028-03-31", "50")]), null);
  assert.equal(computeLifeOfProject(sum, [u("p1", "2028-03-31", "n/a")]), null);
  assert.equal(computeLifeOfProject(sum, []), null);
});
