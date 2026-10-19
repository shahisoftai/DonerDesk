import test from "node:test";
import assert from "node:assert/strict";
import { checkBeneficiary, duplicateCheck, beneficiaryCounts } from "../dist/index.js";

const base = { caseCode: "NG-0042", sex: "FEMALE", ageGroup: "UNDER_5", location: "Ward 3", enrolledOn: "2026-10-14", consentRecorded: true };

test("a record needs a case code, not a name; consent is required; blank location is allowed", () => {
  assert.equal(checkBeneficiary({ ...base, caseCode: "Amina Bello" }).ok, false, "a space is not a case code");
  assert.equal(checkBeneficiary({ ...base, caseCode: "" }).ok, false);
  assert.equal(checkBeneficiary({ ...base, consentRecorded: false }).ok, false);
  assert.deepEqual(checkBeneficiary({ ...base, location: undefined }).value.location, "");
  assert.equal(checkBeneficiary({ ...base, sex: "OTHER" }).ok, false);
});

test("a repeated case code is refused; a probable duplicate is flagged but not refused", () => {
  const same = duplicateCheck(base, [base]);
  assert.equal(same.refused, true);
  const probable = duplicateCheck({ ...base, caseCode: "NG-0043" }, [base]);
  assert.equal(probable.refused, false);
  assert.deepEqual(probable.probable, ["NG-0042"]);
  assert.deepEqual(duplicateCheck({ ...base, caseCode: "NG-0043", sex: "MALE" }, [base]).probable, []);
});

test("counts are per person, and a missing group is absent, not zero", () => {
  const counts = beneficiaryCounts([{ sex: "FEMALE", ageGroup: "UNDER_5" }, { sex: "FEMALE", ageGroup: "AGE_18_59" }, { sex: "MALE", ageGroup: "UNDER_5" }]);
  assert.deepEqual(counts, { total: 3, bySex: { FEMALE: 2, MALE: 1 }, byAgeGroup: { UNDER_5: 2, AGE_18_59: 1 } });
  assert.equal(counts.byAgeGroup.AGE_60_PLUS, undefined);
});
