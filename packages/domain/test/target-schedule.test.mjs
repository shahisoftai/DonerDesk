import test from "node:test";
import assert from "node:assert/strict";
import {
  targetForPeriod, varianceAgainst, describeVariance, parseTargetScheduleText, parseTargetSchedule,
  targetScheduleProblems, formatTargetScheduleText,
} from "../dist/index.js";

const schedule = [{ asOf: "2026-06-30", target: "500" }, { asOf: "2026-03-31", target: "200" }, { asOf: "2026-12-31", target: "1000" }];

test("the target is the latest schedule entry not after the period's end", () => {
  assert.deepEqual(targetForPeriod(schedule, "1000", "2026-03-31"), { target: "200", source: "SCHEDULE", asOf: "2026-03-31" });
  assert.equal(targetForPeriod(schedule, "1000", "2026-05-31").target, "200");
  assert.equal(targetForPeriod(schedule, "1000", "2026-06-30").target, "500");
});

test("before the first entry, or with no schedule, the project target applies", () => {
  assert.deepEqual(targetForPeriod(schedule, "1000", "2026-01-31"), { target: "1000", source: "PROJECT" });
  assert.deepEqual(targetForPeriod([], "750", "2026-05-31"), { target: "750", source: "PROJECT" });
});

test("an unusable entry is ignored in the lookup and reported as a problem", () => {
  const bad = [{ asOf: "2026-13-40", target: "5" }, { asOf: "2026-03-31", target: "abc" }, { asOf: "2026-03-31", target: "9" }];
  assert.equal(targetForPeriod(bad, "100", "2026-12-31").source, "SCHEDULE");
  assert.equal(targetForPeriod(bad, "100", "2026-12-31").target, "9");
  assert.equal(targetScheduleProblems(bad).length, 3);
});

test("variance is absolute and a share of the target; a missing figure has none, never 0", () => {
  assert.deepEqual(varianceAgainst("220", "200"), { absolute: 20, percent: 10 });
  assert.deepEqual(varianceAgainst("150", "200"), { absolute: -50, percent: -25 });
  assert.deepEqual(varianceAgainst("5", "0"), { absolute: 5, percent: null });
  assert.equal(varianceAgainst("", "200"), null);
  assert.equal(varianceAgainst("10", undefined), null);
  assert.equal(varianceAgainst("1,200", "1,000").absolute, 200);
});

test("variance reads plainly", () => {
  assert.equal(describeVariance({ absolute: 20, percent: 10 }), "+20 (+10%)");
  assert.equal(describeVariance({ absolute: -50, percent: -25 }), "-50 (-25%)");
  assert.equal(describeVariance({ absolute: 0, percent: 0 }), "0 (0%)");
  assert.equal(describeVariance({ absolute: 5, percent: null }), "+5");
});

test("text round-trips, and a line that cannot be read is named", () => {
  const { schedule: s, problems } = parseTargetScheduleText("2026-03-31: 200\n\n2026-06-30, 500\nnot a line\n2026-06-30: 600");
  assert.equal(s.length, 3);
  assert.deepEqual(problems.map((p) => p.row), [4, 3]);
  assert.equal(formatTargetScheduleText([{ asOf: "2026-06-30", target: "500" }, { asOf: "2026-03-31", target: "200" }]), "2026-03-31: 200\n2026-06-30: 500");
});

test("stored JSON that is missing or broken is an empty schedule", () => {
  assert.deepEqual(parseTargetSchedule(null), []);
  assert.deepEqual(parseTargetSchedule("{oops"), []);
  assert.deepEqual(parseTargetSchedule('{"a":1}'), []);
  assert.equal(parseTargetSchedule('[{"asOf":"2026-03-31","target":"200"}]').length, 1);
});
