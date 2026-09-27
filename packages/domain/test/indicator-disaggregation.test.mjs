import assert from "node:assert/strict";
import test from "node:test";
import { validateDisaggregation, parseDisaggregationJson, IndicatorUpdate } from "../dist/index.js";

const sex = (f, m) => [
  { dimension: "SEX", category: "Female", value: f },
  { dimension: "SEX", category: "Male", value: m },
];

test("summable indicator: each dimension must add up to the period value", () => {
  assert.equal(validateDisaggregation(sex("60", "40"), { indicatorType: "NUMBER", periodAchievement: "100" }).ok, true);
  const bad = validateDisaggregation(sex("60", "30"), { indicatorType: "NUMBER", periodAchievement: "100" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.details.code, "DISAGGREGATION_TOTAL_MISMATCH");
  const mixed = [...sex("1,000", "500"), { dimension: "AGE_GROUP", category: "Under 5", value: "1500" }];
  assert.equal(validateDisaggregation(mixed, { indicatorType: "CURRENCY", periodAchievement: "1,500" }).ok, true);
});

test("percentages and empty totals are stored without a sum check", () => {
  assert.equal(validateDisaggregation(sex("55", "48"), { indicatorType: "PERCENTAGE", periodAchievement: "51" }).ok, true);
  assert.equal(validateDisaggregation(sex("5", "4"), { indicatorType: "NUMBER", periodAchievement: "" }).ok, true);
});

test("rejects duplicates, blank categories, non-numbers and unknown dimensions; trims", () => {
  const ctx = { indicatorType: "TEXT", periodAchievement: "" };
  assert.equal(validateDisaggregation([...sex("1", "1"), { dimension: "SEX", category: " female ", value: "1" }], ctx).ok, false);
  assert.equal(validateDisaggregation([{ dimension: "SEX", category: " ", value: "1" }], ctx).ok, false);
  assert.equal(validateDisaggregation([{ dimension: "SEX", category: "F", value: "many" }], ctx).ok, false);
  assert.equal(validateDisaggregation([{ dimension: "RELIGION", category: "x", value: "1" }], ctx).ok, false);
  const ok = validateDisaggregation([{ dimension: "OTHER", category: "  Host community ", value: " 7 " }], ctx);
  assert.deepEqual(ok.value, [{ dimension: "OTHER", category: "Host community", value: "7" }]);
});

test("json parsing is defensive and the aggregate returns copies", () => {
  assert.deepEqual(parseDisaggregationJson("oops"), []);
  assert.deepEqual(parseDisaggregationJson('[{"dimension":"SEX","category":"F","value":"1"},{"bad":true}]'), [{ dimension: "SEX", category: "F", value: "1" }]);
  const upd = IndicatorUpdate.create({
    id: "u", tenantId: "t", indicatorId: "i", reportingPeriodId: "p",
    periodAchievement: "2", cumulativeAchievement: "2", createdById: "c", disaggregation: sex("1", "1"),
  });
  upd.disaggregation[0].value = "999";
  assert.equal(upd.disaggregation[0].value, "1");
  upd.edit({ disaggregation: [] });
  assert.deepEqual(upd.disaggregation, []);
});
