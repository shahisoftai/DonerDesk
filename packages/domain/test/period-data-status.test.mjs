import test from "node:test";
import assert from "node:assert/strict";
import { summarizePeriodData, describePeriodData, SUBMITTABLE_STATUSES } from "../dist/index.js";

const st = (...s) => summarizePeriodData(s);

test("status is derived from the values: nothing, drafts, returned, handed in, verified", () => {
  assert.equal(st().status, "NO_DATA");
  assert.equal(st("DRAFT", "DRAFT").status, "IN_PROGRESS");
  assert.equal(st("DRAFT", "SUBMITTED", "VERIFIED").status, "IN_PROGRESS");
  assert.equal(st("SUBMITTED", "SUBMITTED").status, "SUBMITTED");
  assert.equal(st("SUBMITTED", "VERIFIED").status, "SUBMITTED");
  assert.equal(st("VERIFIED", "VERIFIED").status, "VERIFIED");
  assert.equal(st("NEEDS_CORRECTION", "DRAFT").status, "RETURNED");
  assert.equal(st("REJECTED", "VERIFIED").status, "RETURNED");
});

test("counts add up and unknown statuses are ignored, never counted as data", () => {
  const s = st("DRAFT", "SUBMITTED", "NEEDS_CORRECTION", "REJECTED", "VERIFIED", "MYSTERY");
  assert.deepEqual([s.drafts, s.submitted, s.returned, s.verified, s.total], [1, 1, 2, 1, 5]);
});

test("the sentence agrees with the counts", () => {
  assert.match(describePeriodData(st()), /No values/);
  assert.match(describePeriodData(st("DRAFT")), /1 value still being entered\. Submit/);
  assert.match(describePeriodData(st("DRAFT", "DRAFT", "SUBMITTED")), /2 values still being entered; 1 value already handed in/);
  assert.match(describePeriodData(st("NEEDS_CORRECTION")), /1 value sent back for changes\. Correct it/);
  assert.match(describePeriodData(st("SUBMITTED", "VERIFIED")), /2 values handed in \(1 already verified\), waiting for review/);
  assert.match(describePeriodData(st("VERIFIED")), /All 1 value verified/);
});

test("drafts and returned values can be handed in; handed-in and verified ones cannot", () => {
  assert.deepEqual([...SUBMITTABLE_STATUSES].sort(), ["DRAFT", "NEEDS_CORRECTION"]);
});
