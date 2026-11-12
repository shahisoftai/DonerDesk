import assert from "node:assert/strict";
import test from "node:test";
import { VOCABULARY_PRESETS, DEFAULT_VOCABULARY, levelName, documentName, vocabularyProblems, parseVocabulary, presetKeyOf, presetVocabulary, LOGFRAME_LEVELS } from "../dist/index.js";

test("every preset names all four levels, distinctly, and passes the check", () => {
  for (const p of VOCABULARY_PRESETS) {
    for (const level of LOGFRAME_LEVELS) assert.ok(p.vocabulary.levels[level], `${p.key} ${level}`);
    assert.deepEqual(vocabularyProblems(p.vocabulary), [], p.key);
  }
  assert.equal(new Set(VOCABULARY_PRESETS.map((p) => p.key)).size, VOCABULARY_PRESETS.length);
});

test("level and document names follow the vocabulary, and fall back to the default", () => {
  const usaid = presetVocabulary("USAID");
  assert.equal(levelName("OUTCOME", usaid), "Intermediate Result");
  assert.equal(documentName(usaid), "Results Framework");
  assert.equal(levelName("GOAL"), "Goal");
  assert.equal(levelName("GOAL", { document: "x", levels: { GOAL: "", OUTCOME: "", OUTPUT: "", ACTIVITY: "" } }), "Goal");
});

test("typed words must be present, short, distinct and free of codes", () => {
  const base = { document: "Our framework", levels: { GOAL: "Vision", OUTCOME: "Change", OUTPUT: "Delivery", ACTIVITY: "Task" } };
  assert.deepEqual(vocabularyProblems(base), []);
  assert.deepEqual(vocabularyProblems({ ...base, document: " " }), [{ code: "EMPTY", field: "document" }]);
  assert.deepEqual(vocabularyProblems({ ...base, levels: { ...base.levels, OUTPUT: "x".repeat(41) } }), [{ code: "TOO_LONG", field: "OUTPUT" }]);
  assert.deepEqual(vocabularyProblems({ ...base, levels: { ...base.levels, OUTPUT: "Change" } }), [{ code: "DUPLICATE", field: "OUTPUT" }]);
  assert.deepEqual(vocabularyProblems({ ...base, levels: { ...base.levels, OUTPUT: "output_level" } }), [{ code: "RAW_TOKEN", field: "OUTPUT" }]);
});

test("stored text that is unreadable or incomplete reads as the default, never half a vocabulary", () => {
  for (const bad of [undefined, null, "", "nope", "{}", '{"document":"x"}', '{"document":"x","levels":{"GOAL":"a"}}', JSON.stringify({ document: "x", levels: { GOAL: "a", OUTCOME: "a", OUTPUT: "b", ACTIVITY: "c" } })]) {
    assert.deepEqual(parseVocabulary(bad), DEFAULT_VOCABULARY, String(bad));
  }
  const fcdo = presetVocabulary("FCDO");
  assert.deepEqual(parseVocabulary(JSON.stringify(fcdo)), fcdo);
});

test("a vocabulary is recognised as its preset, or custom", () => {
  assert.equal(presetKeyOf(presetVocabulary("EU")), "EU");
  assert.equal(presetKeyOf({ document: "Mine", levels: { GOAL: "A", OUTCOME: "B", OUTPUT: "C", ACTIVITY: "D" } }), "CUSTOM");
});
