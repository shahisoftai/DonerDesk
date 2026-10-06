import assert from "node:assert/strict";
import test from "node:test";
import { findingsExplaining } from "../dist/index.js";

const finding = (over) => ({ indicatorId: "i", indicatorCode: "HL-1", status: "REPORTED", value: "2500", cumulativeValue: "7000", target: "8000", baseline: "0", unit: "x", calculationMethod: "m", reportingPeriodId: "p", sourceRecordIds: [], qualityFlags: [], computedAt: new Date(), ...over });
const atoms = (...xs) => xs.map(([value, role = "ACHIEVEMENT", isPercent]) => ({ value, role, isPercent }));

test("figures a verified finding carries are explained, named by indicator (25.3)", () => {
  assert.deepEqual(findingsExplaining(atoms(["7000"], ["8000", "TARGET"], ["87.5", "PERCENT", true]), [finding()]), ["HL-1"], "cumulative, target and its percent of target");
  assert.deepEqual(findingsExplaining(atoms(["2500"], ["31.25", "PERCENT", true]), [finding()]), ["HL-1"]);
  assert.deepEqual(findingsExplaining(atoms(["20"], ["12", "DATE"]), [finding({ value: "20" })]), ["HL-1"], "dates and counts are ignored");
});

test("one unexplained figure, an unmeasured finding or no figures means no confirmation", () => {
  assert.equal(findingsExplaining(atoms(["7000"], ["91", "PERCENT", true]), [finding()]), undefined);
  assert.equal(findingsExplaining(atoms(["7000"]), [finding({ status: "NOT_MEASURED", value: "0" })]), undefined);
  assert.equal(findingsExplaining([], [finding()]), undefined);
  assert.equal(findingsExplaining(atoms(["12", "DATE"]), [finding()]), undefined);
});

test("several indicators may explain one statement; a recorded breakdown value counts", () => {
  const a = finding({ indicatorCode: "A", value: "10", cumulativeValue: undefined, target: undefined });
  const b = finding({ indicatorCode: "B", value: "55", cumulativeValue: undefined, target: undefined, disaggregation: [{ dimension: "SEX", category: "Female", value: "30" }] });
  assert.deepEqual(findingsExplaining(atoms(["10"], ["55"], ["30"]), [a, b]).sort(), ["A", "B"]);
});
