import test from "node:test";
import assert from "node:assert/strict";
import { parseSubmissions } from "../dist/index.js";

const csv = (...lines) => ["group_intro/case_code,group_intro/sex,age_group,location,date,consent", ...lines].join("\n");

test("a clean export becomes beneficiary rows; labels and yes/no are read", () => {
  const res = parseSubmissions(csv("NG-0001,female,under_5,Ward 3,2026-10-14,yes", "NG-0002,Male,60+,Ward 1,2026-10-14,1"));
  assert.equal(res.ok, true);
  assert.equal(res.value.problems.length, 0);
  assert.deepEqual(res.value.rows.map((r) => [r.caseCode, r.sex, r.ageGroup, r.consentRecorded]), [["NG-0001", "FEMALE", "UNDER_5", true], ["NG-0002", "MALE", "AGE_60_PLUS", true]]);
});

test("a bad row is named by its line, and it is reported with the others", () => {
  const res = parseSubmissions(csv("NG-0001,female,under_5,Ward 3,2026-10-14,yes", "NG-0002,unknown,under_5,Ward 3,2026-10-14,yes", "NG-0003,male,under_5,Ward 3,2026-10-14,maybe", "NG-0004,male,under_5,Ward 3,2026-02-30,yes"));
  assert.deepEqual(res.value.problems.map((p) => p.line), [3, 4, 5]);
  assert.match(res.value.problems[0].message, /sex/);
  assert.match(res.value.problems[2].message, /date/i);
});

test("a case code repeated inside the file is named for both lines", () => {
  const res = parseSubmissions(csv("NG-0001,female,under_5,A,2026-10-14,yes", "NG-0001,male,under_5,A,2026-10-15,yes"));
  assert.equal(res.value.problems.length, 1);
  assert.match(res.value.problems[0].message, /also appears on line 2/);
});

test("a file without the needed columns is refused, and an empty file is refused", () => {
  assert.equal(parseSubmissions("name,age\nAmina,4").ok, false);
  assert.equal(parseSubmissions("case_code,sex,age_group,date,consent").ok, false, "no submissions");
});
