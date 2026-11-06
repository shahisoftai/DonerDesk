import assert from "node:assert/strict";
import test from "node:test";
import { indicatorValueProblem, assertIndicatorValues } from "../dist/index.js";

const count = { code: "OUT-1", type: "NUMBER", unit: "people", baseline: "0", target: "100" };
const pct = { code: "IND-9", type: "PERCENTAGE", baseline: "10", target: "80" };

test("ME-05: counts must be numbers; commas and spaces are fine; empty is fine", () => {
  assert.equal(indicatorValueProblem(count, "1,250", "period"), null);
  assert.equal(indicatorValueProblem(count, " 40 ", "period"), null);
  assert.equal(indicatorValueProblem(count, "", "period"), null);
  assert.match(indicatorValueProblem(count, "abc", "period"), /^OUT-1: the period value "abc" is not a number\.$/);
  assert.match(indicatorValueProblem(count, "12 people", "cumulative"), /not a number/);
  assert.match(indicatorValueProblem(count, "1e99", "period"), /not a number/, "scientific notation is not a count");
});

test("ME-05: a count cannot be negative unless the indicator is built around negatives", () => {
  assert.match(indicatorValueProblem(count, "-5", "period"), /negative/);
  assert.equal(indicatorValueProblem({ ...count, baseline: "-10", target: "0", unit: "points" }, "-5", "period"), null);
});

test("ME-05: a percentage is 0 to 100, with or without the % sign; the % unit counts too", () => {
  assert.equal(indicatorValueProblem(pct, "85", "period"), null);
  assert.equal(indicatorValueProblem(pct, "85%", "period"), null);
  assert.equal(indicatorValueProblem(pct, "0", "period"), null);
  assert.equal(indicatorValueProblem(pct, "100", "period"), null);
  assert.match(indicatorValueProblem(pct, "450", "period"), /not a possible percentage/);
  assert.match(indicatorValueProblem(pct, "-1", "period"), /not a possible percentage/);
  assert.match(indicatorValueProblem({ ...count, unit: "%" }, "101", "cumulative"), /not a possible percentage/);
});

test("ME-05: yes/no, ratio, currency and free-text indicators follow their own rules", () => {
  const yn = { code: "Y", type: "YES_NO" };
  for (const ok of ["Yes", "no", "TRUE", "1"]) assert.equal(indicatorValueProblem(yn, ok, "period"), null, ok);
  assert.match(indicatorValueProblem(yn, "maybe", "period"), /Yes or No/);
  const ratio = { code: "R", type: "RATIO" };
  for (const ok of ["1.5", "3:2", "3 / 2"]) assert.equal(indicatorValueProblem(ratio, ok, "period"), null, ok);
  assert.match(indicatorValueProblem(ratio, "three to two", "period"), /ratio such as 3:2/);
  assert.match(indicatorValueProblem(ratio, "-2", "period"), /negative/);
  assert.equal(indicatorValueProblem({ code: "C", type: "CURRENCY" }, "12,500.50", "period"), null);
  assert.match(indicatorValueProblem({ code: "C", type: "CURRENCY" }, "-3", "period"), /negative/);
  assert.equal(indicatorValueProblem({ code: "T", type: "TEXT" }, "anything at all", "period"), null);
  assert.equal(indicatorValueProblem({ code: "X", type: "CUSTOM" }, "whatever", "period"), null);
});

test("ME-05: assertIndicatorValues names the indicator and checks both values", () => {
  assert.doesNotThrow(() => assertIndicatorValues(count, { periodAchievement: "10", cumulativeAchievement: "" }));
  assert.throws(() => assertIndicatorValues(count, { periodAchievement: "10", cumulativeAchievement: "x" }), /OUT-1: the cumulative value/);
  assert.throws(() => assertIndicatorValues(pct, { periodAchievement: "450" }), (e) => e.code === "VALIDATION_FAILED");
});
