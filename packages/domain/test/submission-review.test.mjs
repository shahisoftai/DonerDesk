import test from "node:test";
import assert from "node:assert/strict";
import { parseSubmissions, reviewRows } from "../dist/index.js";

const csv = ["case_code,sex,age_group,location,date,consent", "NG-1,female,under_5,Ward 3,2026-10-14,yes", "NG-9,female,under_5,Ward 3,2026-10-14,yes", "NG-2,male,18_59,Ward 1,2026-10-15,yes"].join("\n");

test("a row whose case code is used is a clash; one that matches a person on another day or sex is not listed", () => {
  const { rows } = parseSubmissions(csv).value;
  const existing = [
    { caseCode: "NG-1", sex: "FEMALE", ageGroup: "UNDER_5", location: "Ward 3", enrolledOn: "2026-10-14" },
    { caseCode: "NG-5", sex: "FEMALE", ageGroup: "UNDER_5", location: "Ward 3", enrolledOn: "2026-10-14" },
  ];
  const res = reviewRows(rows, existing);
  assert.deepEqual(res.clashes, [{ line: 2, caseCode: "NG-1" }]);
  assert.deepEqual(res.likely, [{ line: 3, caseCode: "NG-9", looksLike: ["NG-1", "NG-5"] }]);
});
