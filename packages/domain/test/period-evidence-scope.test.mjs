import test from "node:test";
import assert from "node:assert/strict";
import { periodEvidenceMode, isEvidenceInPeriodScope, resolveEvidencePeriod } from "../dist/index.js";

test("roll-up report types cover project evidence, the others their own period", () => {
  for (const t of ["FINAL", "ANNUAL", "SEMI_ANNUAL"]) assert.equal(periodEvidenceMode(t), "PROJECT", t);
  for (const t of ["MONTHLY", "QUARTERLY", "ACTIVITY", "SITUATION", "CUSTOM", "UNKNOWN"]) assert.equal(periodEvidenceMode(t), "PERIOD", t);
});

test("period scope: tagged to the period or to one of its activities", () => {
  const scope = { mode: "PERIOD", periodId: "p1", activityIds: new Set(["a1"]) };
  const cases = [
    [{ reportingPeriodId: "p1" }, true],
    [{ activityId: "a1" }, true],
    [{ reportingPeriodId: "p2", activityId: "a1" }, true],
    [{ reportingPeriodId: "p2" }, false],
    [{ activityId: "a2" }, false],
    [{}, false],
  ];
  for (const [file, expected] of cases) assert.equal(isEvidenceInPeriodScope(file, scope), expected, JSON.stringify(file));
});

test("project scope covers every file", () => {
  assert.equal(isEvidenceInPeriodScope({}, { mode: "PROJECT", periodId: "p1", activityIds: new Set() }), true);
});

test("resolveEvidencePeriod: explicit beats activity, none when neither", () => {
  assert.deepEqual(resolveEvidencePeriod("p1", "p2"), { periodId: "p1", source: "explicit" });
  assert.deepEqual(resolveEvidencePeriod(undefined, "p2"), { periodId: "p2", source: "activity" });
  assert.deepEqual(resolveEvidencePeriod(undefined, undefined), { source: "none" });
});
