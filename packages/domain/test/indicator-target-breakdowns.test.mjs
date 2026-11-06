import test from "node:test";
import assert from "node:assert/strict";
import { Indicator, validateTargetBreakdowns } from "../dist/index.js";

const ENTRY = (dimension, category, value) => ({ dimension, category, value });

test("breakdown targets: a summable indicator's groups in one dimension must add up to the total target", () => {
  const ok = validateTargetBreakdowns([ENTRY("SEX", "Women", "90"), ENTRY("SEX", "Men", "60")], { indicatorType: "NUMBER", target: "150" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.length, 2);
  const bad = validateTargetBreakdowns([ENTRY("SEX", "Women", "90"), ENTRY("SEX", "Men", "50")], { indicatorType: "NUMBER", target: "150" });
  assert.equal(bad.ok, false);
});

test("breakdown targets: no total target means nothing to add up to, and a percentage is not summed", () => {
  assert.equal(validateTargetBreakdowns([ENTRY("SEX", "Women", "90")], { indicatorType: "NUMBER", target: "" }).ok, true);
  assert.equal(validateTargetBreakdowns([ENTRY("SEX", "Women", "60"), ENTRY("SEX", "Men", "60")], { indicatorType: "PERCENTAGE", target: "50" }).ok, true);
});

test("breakdown targets: an unknown dimension, a duplicate group and a non-number are refused", () => {
  assert.equal(validateTargetBreakdowns([ENTRY("HEIGHT", "Tall", "3")], { indicatorType: "NUMBER", target: "" }).ok, false);
  assert.equal(validateTargetBreakdowns([ENTRY("SEX", "Women", "1"), ENTRY("SEX", "Women", "2")], { indicatorType: "NUMBER", target: "" }).ok, false);
  assert.equal(validateTargetBreakdowns([ENTRY("SEX", "Women", "many")], { indicatorType: "NUMBER", target: "" }).ok, false);
});

test("an indicator carries its breakdown targets, and none by default", () => {
  const base = { id: "i1", tenantId: "t", projectId: "p", logframeItemId: "x", code: "1.1", name: "Children screened", type: "NUMBER", baseline: "", target: "100" };
  assert.deepEqual(Indicator.create(base).targetBreakdowns, []);
  const withTargets = Indicator.create({ ...base, targetBreakdowns: [ENTRY("AGE_GROUP", "Under 5", "100")] });
  assert.equal(withTargets.targetBreakdowns[0].category, "Under 5");
});
