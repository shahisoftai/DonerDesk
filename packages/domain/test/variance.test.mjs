import assert from "node:assert/strict";
import test from "node:test";
import { offTargetFindings, isSatisfiedByFacts, CHECKLIST_KIND } from "../dist/index.js";

const finding = (over = {}) => ({
  indicatorId: "i1", indicatorCode: "OUT-1", value: "10", status: "REPORTED", indicatorType: "NUMBER", unit: "people", target: "100",
  semantics: { status: "CONFIGURED", direction: "HIGHER_IS_BETTER", aggregation: "SUM" },
  lifeOfProject: { value: "50", basis: "COMPUTED", periodsCovered: 6, asOf: "2026-09-30" },
  ...over,
});

test("H-9: a closing report with a result 20% or more short of target needs an explanation", () => {
  assert.equal(offTargetFindings([finding()], "FINAL").length, 1);
  assert.equal(offTargetFindings([finding({ lifeOfProject: { value: "80", basis: "COMPUTED", periodsCovered: 6, asOf: "x" } })], "FINAL").length, 0, "exactly 20% short is within tolerance");
  assert.equal(offTargetFindings([finding({ lifeOfProject: { value: "79", basis: "COMPUTED", periodsCovered: 6, asOf: "x" } })], "FINAL").length, 1);
});

test("H-9: direction decides what is unfavourable", () => {
  const lower = { semantics: { status: "CONFIGURED", direction: "LOWER_IS_BETTER", aggregation: "SUM" }, target: "100" };
  assert.equal(offTargetFindings([finding({ ...lower, lifeOfProject: { value: "150", basis: "COMPUTED", periodsCovered: 1, asOf: "x" } })], "FINAL").length, 1);
  assert.equal(offTargetFindings([finding({ ...lower, lifeOfProject: { value: "50", basis: "COMPUTED", periodsCovered: 1, asOf: "x" } })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ lifeOfProject: { value: "150", basis: "COMPUTED", periodsCovered: 1, asOf: "x" } })], "FINAL").length, 0, "exceeding a higher-is-better target is not a shortfall");
});

test("H-9: only judged when there is something to judge", () => {
  assert.equal(offTargetFindings([finding()], "MONTHLY").length, 0, "earlier reports have no phased target to miss");
  assert.equal(offTargetFindings([finding()], "ANNUAL").length, 0);
  assert.equal(offTargetFindings([finding({ indicatorType: "PERCENTAGE" })], "FINAL").length, 0, "rates are not judged against a target");
  assert.equal(offTargetFindings([finding({ unit: "%" })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ status: "NOT_MEASURED" })], "FINAL").length, 0, "a missing value is never a miss");
  assert.equal(offTargetFindings([finding({ target: undefined })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ target: "0" })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ semantics: { status: "REQUIRES_REVIEW", direction: "HIGHER_IS_BETTER", aggregation: "SUM" } })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ semantics: { status: "CONFIGURED", direction: "NEUTRAL", aggregation: "SUM" } })], "FINAL").length, 0);
  assert.equal(offTargetFindings([finding({ lifeOfProject: undefined })], "FINAL").length, 0);
});

test("H-9: the item is a state item that closes when the story explains it or the indicator is back on target", () => {
  assert.equal(CHECKLIST_KIND.VARIANCE_UNEXPLAINED, "STATE");
  const off = new Set(["i1"]);
  assert.equal(isSatisfiedByFacts("VARIANCE_UNEXPLAINED", { offTargetIndicatorIds: off, varianceExplained: false }, "i1"), false);
  assert.equal(isSatisfiedByFacts("VARIANCE_UNEXPLAINED", { offTargetIndicatorIds: off, varianceExplained: true }, "i1"), true);
  assert.equal(isSatisfiedByFacts("VARIANCE_UNEXPLAINED", { offTargetIndicatorIds: new Set(), varianceExplained: false }, "i1"), true);
  assert.equal(isSatisfiedByFacts("VARIANCE_UNEXPLAINED", {}, "i1"), false, "unknown facts say nothing");
});
