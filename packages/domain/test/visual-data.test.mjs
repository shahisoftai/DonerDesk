import test from "node:test";
import assert from "node:assert/strict";
import {
  DATA_SOURCES, FIELD_TYPES, JOIN_KEYS, AUDIT_TO_SOURCES, blocksToRefresh, bumpVersion, changedSources, evaluateCalculated, fieldOf,
  guestSources, isGuestSafe, resolveFieldRef, searchFields, sharedJoins, sourceOf, sourcesOf, sourcesTouchedBy, validateVisualQuery, ageOf,
} from "../dist/index.js";

const q = (over = {}) => ({ source: "indicator-values", measures: ["period_value"], groupBy: ["period"], includeDraft: false, ...over });
const codes = (query) => validateVisualQuery(query).map((p) => p.code);

test("the catalogue is complete: unique ids, known types and joins, every source has a reader, fields and a way in", () => {
  const ids = new Set();
  for (const s of DATA_SOURCES) {
    assert.ok(!ids.has(s.id), `duplicate source ${s.id}`); ids.add(s.id);
    assert.ok(s.reader && s.grain && s.description && s.fields.length > 0, `${s.id} is missing a part`);
    assert.ok(s.joins.every((j) => JOIN_KEYS.includes(j)), `${s.id} has an unknown join`);
    const fieldIds = new Set();
    for (const f of s.fields) {
      assert.ok(!fieldIds.has(f.id), `${s.id}.${f.id} duplicated`); fieldIds.add(f.id);
      assert.ok(FIELD_TYPES.includes(f.type), `${s.id}.${f.id} has an unknown type`);
      assert.ok(f.label && f.meaning, `${s.id}.${f.id} needs a label and a meaning`);
      if (f.joinKey) assert.ok(s.joins.includes(f.joinKey), `${s.id}.${f.id} names a join its source does not declare`);
      if (f.type === "RATE") assert.ok(!f.additive, `${s.id}.${f.id} is a rate and cannot be additive`);
      if (f.money) assert.equal(f.type, "AMOUNT");
    }
    assert.ok(s.fields.some((f) => f.role === "MEASURE") || s.id === "periods" || s.id === "library", `${s.id} has no figure to show`);
  }
  assert.ok(DATA_SOURCES.length >= 15);
});

test("money and finance never reach a guest, and nothing money-shaped is guest-safe", () => {
  for (const s of DATA_SOURCES) if (s.fields.some((f) => f.money)) assert.equal(s.guest, false, `${s.id} carries money and must not be open to a guest`);
  assert.ok(guestSources().every((s) => !["funding", "spending", "projects", "programmes"].includes(s.id)));
  assert.equal(isGuestSafe(q()), true);
  assert.equal(isGuestSafe({ source: "spending", measures: ["spent"], groupBy: [], currency: "USD", includeDraft: false }), false);
});

test("a field is found by its own name or through a source, and unknown names are not guessed", () => {
  assert.equal(resolveFieldRef("period_value", "indicator-values")?.field.label, "Value this period");
  assert.equal(resolveFieldRef("results-by-place.place", "indicator-values")?.source, "results-by-place");
  assert.equal(resolveFieldRef("nope", "indicator-values"), undefined);
  assert.equal(fieldOf("plan", "delivery_state")?.type, "STATUS");
  assert.ok(sharedJoins("indicator-values", "results-by-place").includes("INDICATOR"));
  assert.deepEqual(sharedJoins("risks", "spending"), [], "project alone is not a way to match rows");
  assert.deepEqual(sharedJoins("plan", "activities").sort(), ["LOGFRAME_NODE", "PERIOD", "PLACE"]);
});

test("search ranks label hits above meaning hits and returns nothing for no words", () => {
  assert.deepEqual(searchFields("  "), []);
  const hits = searchFields("target");
  assert.equal(hits[0].field.id, "target");
  assert.ok(searchFields("people reached").some((h) => h.source.id === "reach"));
  assert.ok(searchFields("zzzzzz").length === 0);
});

test("a sound question has no problems; the honesty rules are refusals with a code", () => {
  assert.deepEqual(validateVisualQuery(q()), []);
  assert.deepEqual(codes(q({ source: "nope" })), ["UNKNOWN_SOURCE"]);
  assert.ok(codes(q({ measures: [] })).includes("NO_MEASURE"));
  assert.ok(codes(q({ measures: ["period"] })).includes("DIMENSION_AS_MEASURE"));
  assert.ok(codes(q({ groupBy: ["period_value"] })).includes("MEASURE_AS_GROUP"));
  assert.ok(codes(q({ measures: ["nothing"] })).includes("UNKNOWN_FIELD"));
  assert.ok(codes(q({ aggregate: { rate_value: "SUM" }, measures: ["rate_value"] })).includes("RATE_SUMMED"), "a rate is never added up");
  assert.ok(codes({ source: "reach", measures: ["unique_registered"], groupBy: [], aggregate: { unique_registered: "SUM" }, includeDraft: false }).includes("NOT_ADDITIVE_SUMMED"), "unique people are not summed");
  assert.ok(codes(q({ aggregate: { period_value: "SUM" } })).length === 0, "an additive count may be summed");
  assert.ok(codes(q({ limit: 0 })).includes("BAD_LIMIT") && codes(q({ limit: 99999 })).includes("BAD_LIMIT"));
  assert.ok(codes(q({ filters: [{ field: "status", values: [] }] })).includes("BAD_FILTER"));
});

test("money needs one currency or a grouping by currency; sources join only through a declared key", () => {
  const spend = { source: "spending", measures: ["spent"], groupBy: [], includeDraft: false };
  assert.ok(codes(spend).includes("MONEY_NEEDS_CURRENCY"));
  assert.deepEqual(codes({ ...spend, currency: "USD" }), []);
  assert.deepEqual(codes({ ...spend, groupBy: ["funding.currency"] }), []);
  assert.ok(codes({ source: "risks", measures: ["risk_count"], groupBy: ["results-by-place.place"], includeDraft: false }).includes("JOIN_NOT_DECLARED"));
  assert.deepEqual(codes(q({ groupBy: ["results-by-place.place"] })), []);
  assert.deepEqual(sourcesOf(q({ groupBy: ["results-by-place.place"] })).sort(), ["indicator-values", "results-by-place"]);
});

test("a calculated figure follows the formula-indicator rules", () => {
  const ratio = { id: "r", label: "Share", op: "RATIO", terms: ["period_value", "target"], percent: true };
  const withCalc = (c, measures = ["period_value", "target"]) => codes(q({ measures, calculated: [c] }));
  assert.deepEqual(withCalc(ratio), []);
  assert.ok(withCalc({ ...ratio, terms: ["period_value"] }).includes("CALCULATED_PROBLEM"), "a ratio needs two figures");
  assert.ok(withCalc({ ...ratio, terms: ["period_value", "rate_value"] }, ["period_value", "rate_value"]).includes("CALCULATED_PROBLEM"), "a rate is never divided");
  assert.ok(withCalc({ ...ratio, terms: ["period_value", "cumulative"] }).includes("CALCULATED_PROBLEM"), "terms must be among the chosen figures");
  assert.ok(codes({ source: "spending", measures: ["spent", "burn_rate"], groupBy: [], currency: "USD", includeDraft: false, calculated: [{ id: "x", label: "x", op: "SUM", terms: ["spent", "burn_rate"] }] }).includes("CALCULATED_PROBLEM"));
});

test("evaluation: a missing term or a zero divisor is not measured, never 0 or a partial sum", () => {
  const ratio = { id: "r", label: "r", op: "RATIO", terms: ["a", "b"], percent: true };
  assert.equal(evaluateCalculated(ratio, { a: 50, b: 200 }), 25);
  assert.equal(evaluateCalculated(ratio, { a: 50, b: 0 }), null);
  assert.equal(evaluateCalculated(ratio, { a: null, b: 200 }), null);
  assert.equal(evaluateCalculated(ratio, { a: 0, b: 200 }), 0, "a real 0 is a real 0");
  assert.equal(evaluateCalculated({ ...ratio, op: "SUM", terms: ["a", "b", "c"] }, { a: 1, b: 2, c: 3 }), 6);
  assert.equal(evaluateCalculated({ ...ratio, op: "SUM", terms: ["a", "b", "c"] }, { a: 1, b: 2 }), null);
  assert.equal(evaluateCalculated({ ...ratio, op: "DIFFERENCE", terms: ["a", "b"] }, { a: 10, b: 4 }), 6);
  assert.equal(evaluateCalculated({ ...ratio, op: "SHARE", percent: false }, { a: 1, b: 3 }), 0.333333);
});

test("live data: audit actions map to sources, versions only go up, and only affected blocks refresh", () => {
  assert.deepEqual(sourcesTouchedBy("logframe.indicator.verified").sort(), ["disaggregation", "indicator-values", "projects", "results-by-place"]);
  assert.deepEqual(sourcesTouchedBy("something.unknown"), []);
  assert.ok(sourcesTouchedBy("finance.expense.approved").includes("spending"));
  const reachable = new Set(AUDIT_TO_SOURCES.flatMap(([, s]) => s));
  for (const s of DATA_SOURCES) assert.ok(reachable.has(s.id) || s.id === "library", `no audit action reaches source ${s.id}`);
  for (const [, sources] of AUDIT_TO_SOURCES) for (const s of sources) assert.ok(sourceOf(s), `table names unknown source ${s}`);
  const v0 = {};
  const v1 = bumpVersion(v0, ["plan", "activities"]);
  assert.deepEqual(v0, {}, "the old map is not changed");
  assert.deepEqual(changedSources(v0, v1).sort(), ["activities", "plan"]);
  assert.deepEqual(changedSources(v1, v1), []);
  const reads = new Map([["a", ["plan"]], ["b", ["spending"]], ["c", ["indicator-values", "activities"]]]);
  assert.deepEqual(blocksToRefresh(reads, changedSources(v0, v1)).sort(), ["a", "c"]);
});

test("age is reported as a number and a unit", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.deepEqual(ageOf("2026-11-09T11:59:30Z", now), { unit: "seconds", value: 30 });
  assert.deepEqual(ageOf("2026-11-09T11:58:00Z", now), { unit: "minutes", value: 2 });
  assert.deepEqual(ageOf("2026-11-09T09:00:00Z", now), { unit: "hours", value: 3 });
  assert.deepEqual(ageOf("2026-11-07T12:00:00Z", now), { unit: "days", value: 2 });
});
