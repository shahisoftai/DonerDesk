import { test } from "node:test";
import assert from "node:assert/strict";
import { describeReadinessChange, parseReadinessSnapshot, readinessChangeSentence } from "../../src/features/reporting/domain/readiness-change.ts";

const snap = (over = {}) => ({ overall: 80, sections: 100, indicators: 80, evidence: 60, checklist: 70, approval: 0, ...over });

test("nothing to compare, or nothing moved: no message", () => {
  assert.equal(describeReadinessChange(null, snap()), null);
  assert.equal(describeReadinessChange(snap(), snap()), null);
});

test("a drop names the parts that moved, biggest first, at most three", () => {
  const change = describeReadinessChange(snap(), snap({ overall: 40, sections: 50, evidence: 10, checklist: 60, indicators: 70 }))!;
  assert.equal(change.direction, "down");
  assert.deepEqual(change.moved, ["Sections 100% → 50%", "Evidence 60% → 10%", "Indicators 80% → 70%"]);
  assert.equal(readinessChangeSentence(change), "Down from 80% to 40% since your last visit: Sections 100% → 50%, Evidence 60% → 10%, Indicators 80% → 70%.");
});

test("a rise says up", () => {
  const change = describeReadinessChange(snap({ overall: 40 }), snap({ overall: 55, approval: 100 }))!;
  assert.equal(change.direction, "up");
  assert.match(readinessChangeSentence(change), /^Up from 40% to 55%/);
});

test("stored snapshots are validated", () => {
  assert.deepEqual(parseReadinessSnapshot(snap()), snap());
  assert.equal(parseReadinessSnapshot({ overall: "x" }), null);
  assert.equal(parseReadinessSnapshot(null), null);
});
