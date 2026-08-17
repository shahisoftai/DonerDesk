import assert from "node:assert/strict";
import test from "node:test";
import { parseLogframeText, levelRank } from "../dist/index.js";

test("parseLogframeText: tabular CSV with headers", () => {
  const text = [
    "Level,Code,Title,Description",
    "GOAL,G1,Improve community health,Reduced mortality",
    "OUTCOME,O1.1,Better nutrition practices,",
    "OUTPUT,OP1.1.1,Trained health workers,",
    "ACTIVITY,A1.1.1.1,Run training sessions,",
  ].join("\n");
  const { rows, warnings } = parseLogframeText(text);
  assert.equal(rows.length, 4);
  assert.equal(warnings.length, 0);
  assert.deepEqual(
    rows.map((r) => [r.level, r.code, r.title]),
    [
      ["GOAL", "G1", "Improve community health"],
      ["OUTCOME", "O1.1", "Better nutrition practices"],
      ["OUTPUT", "OP1.1.1", "Trained health workers"],
      ["ACTIVITY", "A1.1.1.1", "Run training sessions"],
    ],
  );
  assert.equal(rows[0].description, "Reduced mortality");
  assert.equal(rows[1].description, undefined);
});

test("parseLogframeText: tabular TSV from Excel export", () => {
  const text = [
    "# Sheet1",
    "Level\tCode\tTitle",
    "GOAL\t1\tGoal statement",
    "OUTCOME\t1.1\tOutcome statement",
  ].join("\n");
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].level, "GOAL");
  assert.equal(rows[1].level, "OUTCOME");
  assert.equal(rows[1].code, "1.1");
});

test("parseLogframeText: tabular infers level from dotted codes", () => {
  const text = ["Code,Title", "1,Goal", "1.1,Outcome one", "1.1.1,Output one", "1.1.1.1,Activity one"].join("\n");
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.level), ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);
});

test("parseLogframeText: line-based with explicit level keywords", () => {
  const text = [
    "GOAL: Clean water for all",
    "OUTCOME: Communities use safe water",
    "OUTPUT: Boreholes drilled",
    "ACTIVITY: Site assessment",
  ].join("\n");
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.level), ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);
  assert.equal(rows[0].title, "Clean water for all");
});

test("parseLogframeText: line-based with dotted codes", () => {
  const text = ["1 Goal statement", "1.1 Outcome statement", "1.1.1 Output statement"].join("\n");
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.level), ["GOAL", "OUTCOME", "OUTPUT"]);
  assert.equal(rows[1].code, "1.1");
});

test("parseLogframeText: line-based infers level from indentation", () => {
  const text = ["Goal statement", "  Outcome statement", "    Output statement", "      Activity statement"].join("\n");
  const { rows } = parseLogframeText(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.level), ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);
});

test("parseLogframeText: splits title and description on em dash", () => {
  const { rows } = parseLogframeText("OUTCOME: Safe water — Reduced waterborne disease");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Safe water");
  assert.equal(rows[0].description, "Reduced waterborne disease");
});

test("parseLogframeText: empty input yields no rows", () => {
  const { rows } = parseLogframeText("");
  assert.equal(rows.length, 0);
  const blank = parseLogframeText("  \n\n  ");
  assert.equal(blank.rows.length, 0);
});

test("parseLogframeText: skips rows without a title", () => {
  const text = ["GOAL,Code,Title", "GOAL,G1,", "GOAL,G2,Valid title"].join("\n");
  const { rows, warnings } = parseLogframeText(text);
  assert.equal(rows.length, 1);
  assert.ok(warnings.length > 0);
});

test("levelRank orders levels", () => {
  assert.equal(levelRank("GOAL"), 0);
  assert.equal(levelRank("OUTCOME"), 1);
  assert.equal(levelRank("OUTPUT"), 2);
  assert.equal(levelRank("ACTIVITY"), 3);
});
