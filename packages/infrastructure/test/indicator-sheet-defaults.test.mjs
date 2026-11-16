import test from "node:test";
import assert from "node:assert/strict";
import { readIndicatorSheet } from "../dist/project-setup/indicator-sheet-reader.js";
import { toBlocks } from "../dist/project-setup/source-reader.js";

const blocksOf = (text) => toBlocks(text).map((b, i) => ({ ...b, documentId: "d1", index: i }));
const sheet = [
  "Code\tIndicator\tType\tBaseline\tTarget\tUnit\tFrequency\tBreak down by\tLogframe Code",
  "OC1-1\tOTP cure rate\tPERCENTAGE\t\t75\t%\tMonthly\tSex\tOC1",
  "OP1.1-1\tChildren screened for acute malnutrition\t\t0\t150000\tchildren\tMonthly\tSex\t1.1",
  "OP1.1-2\tFunctional OTP sites reporting\tNumber\t0\t60\tsites\tMonthly\t\t1.1",
].join("\n");

test("an indicator table keeps a stated type and infers one from a plain numeric target", () => {
  const read = readIndicatorSheet(blocksOf(sheet));
  const types = read.fields.indicators.map((i) => i.value.type);
  assert.deepEqual(types, ["PERCENTAGE", "NUMBER", "NUMBER"]);
});

test("the break down by column is read as the indicator's breakdown", () => {
  const read = readIndicatorSheet(blocksOf(sheet));
  assert.deepEqual(read.fields.indicators[0].value.disaggregation, ["Sex"]);
  assert.equal(read.fields.indicators[2].value.disaggregation, null);
});
