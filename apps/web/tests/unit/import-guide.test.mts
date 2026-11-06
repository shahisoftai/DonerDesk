import assert from "node:assert/strict";
import test from "node:test";
import { headerWords, suggestImports, IMPORT_OPTIONS } from "../../src/features/imports/domain/import-guide.ts";

test("the header words come from the first non-empty line, whatever separates them", () => {
  assert.deepEqual(headerWords("\n\nCode\tIndicator,Baseline;Target"), ["code", "indicator", "baseline", "target"]);
  assert.deepEqual(headerWords("   \n  "), []);
});

test("an indicator definition sheet points at the indicator import first", () => {
  const s = suggestImports("Code,Indicator,Baseline,Target,Unit\nIND-1,People,0,100,people", "p1");
  assert.equal(s[0]!.kind, "INDICATORS");
  assert.equal(s[0]!.confidence, "LIKELY");
  assert.equal(s[0]!.href, "/projects/p1/logframe/indicators/import");
  assert.ok(s[0]!.because.includes("baseline"));
});

test("a table of figures by period points at the indicator values", () => {
  const s = suggestImports("Indicator\tPeriod\tValue\tCumulative", "p1");
  assert.equal(s[0]!.kind, "INDICATOR_VALUES");
});

test("completed and planned activities are told apart by their words", () => {
  assert.equal(suggestImports("Activity,Date,Location,Participants", "p1")[0]!.kind, "COMPLETED_ACTIVITIES");
  assert.equal(suggestImports("Title,Planned start,Planned end,Lead", "p1")[0]!.kind, "WORK_PLAN");
});

test("a first line that says nothing recognisable is never guessed at", () => {
  assert.deepEqual(suggestImports("foo,bar,baz", "p1"), []);
  assert.deepEqual(suggestImports("", "p1"), []);
});

test("a single matching word is only a possibility, and accents do not matter", () => {
  const s = suggestImports("Désignation,Amount", "p1");
  assert.equal(s[0]!.kind, "FINANCE");
  assert.equal(s[0]!.confidence, "POSSIBLE");
});

test("every import kind has a place to go and is listed once", () => {
  const kinds = IMPORT_OPTIONS.map((o) => o.kind);
  assert.equal(new Set(kinds).size, kinds.length);
  for (const o of IMPORT_OPTIONS) assert.match(o.href("p1"), /^\//);
});
