import test from "node:test";
import assert from "node:assert/strict";
import { entryStoplight } from "../dist/index.js";

const sem = (over = {}) => ({ aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED", ...over });
const base = { periodEnd: "2026-11-30", baseline: "0", target: "1000" };

test("a total is judged through its cumulative figure against the scheduled target; without a schedule it is not judged", () => {
  const schedule = [{ asOf: "2026-11-30", target: "250" }, { asOf: "2027-02-28", target: "600" }];
  const met = entryStoplight({ ...base, semantics: sem(), schedule, periodValue: "40", cumulativeValue: "260" });
  assert.equal(met.light, "MET");
  assert.equal(met.target, "250");
  assert.equal(met.compared, "260");
  assert.equal(met.variance, "+10 (+4%)");
  const below = entryStoplight({ ...base, semantics: sem(), schedule, periodValue: "400", cumulativeValue: "200" });
  assert.equal(below.light, "BELOW");
  assert.equal(entryStoplight({ ...base, semantics: sem(), periodValue: "40", cumulativeValue: "40" }).light, "NONE");
  assert.match(entryStoplight({ ...base, semantics: sem(), periodValue: "40", cumulativeValue: "40" }).note, /target schedule/);
});

test("a rate or latest value is judged by its own value against the project target", () => {
  const rate = sem({ aggregation: "PERCENTAGE", reportingBasis: "PERIOD" });
  assert.equal(entryStoplight({ periodEnd: "2026-11-30", baseline: "50", target: "90", semantics: rate, periodValue: "92" }).light, "MET");
  assert.equal(entryStoplight({ periodEnd: "2026-11-30", baseline: "50", target: "90", semantics: rate, periodValue: "70" }).light, "BELOW");
});

test("lower is better reads the other way", () => {
  const lower = sem({ aggregation: "LATEST", direction: "LOWER_IS_BETTER" });
  assert.equal(entryStoplight({ periodEnd: "2026-11-30", baseline: "20", target: "10", semantics: lower, periodValue: "8" }).light, "MET");
  assert.equal(entryStoplight({ periodEnd: "2026-11-30", baseline: "20", target: "10", semantics: lower, periodValue: "14" }).light, "BELOW");
});

test("no light, with a reason, when unconfirmed, no value, no target, or exactly neutral", () => {
  const rate = sem({ aggregation: "PERCENTAGE" });
  assert.match(entryStoplight({ ...base, semantics: sem({ status: "REQUIRES_REVIEW" }), periodValue: "5" }).note, /not been confirmed/);
  assert.match(entryStoplight({ ...base, semantics: sem({ direction: "NEUTRAL" }), periodValue: "5" }).note, /not been confirmed/);
  assert.match(entryStoplight({ periodEnd: "x", target: "90", semantics: rate }).note, /No value/);
  assert.match(entryStoplight({ periodEnd: "x", target: "", baseline: "", semantics: rate, periodValue: "5" }).note, /no target/);
  assert.equal(entryStoplight({ periodEnd: "x", target: "abc", semantics: rate, periodValue: "5" }).light, "NONE");
  assert.equal(entryStoplight({ periodEnd: "x", target: "90", semantics: rate, periodValue: "n/a" }).light, "NONE");
});

test("a value exactly on the target is met", () => {
  assert.equal(entryStoplight({ periodEnd: "x", target: "90", baseline: "0", semantics: sem({ aggregation: "PERCENTAGE" }), periodValue: "90" }).light, "MET");
});
