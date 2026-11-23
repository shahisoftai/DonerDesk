import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraft, applyOperation, applyResultOperation, evaluateRequirements, SETUP_REQUIREMENTS, openRequirements, adviceNotes, canLaunch, isDefaultVocabulary, presetVocabulary, DEFAULT_VOCABULARY, logframeSheet } from "../dist/index.js";

const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const node = (level, code, parentCode, extra = {}) => item({ level, code, title: `${level} ${code}`, description: null, parentCode, codeSource: "DOCUMENT", ...extra });

test("52.5: the wizard's wording is one of the listed presets, and an empty choice puts the default back", () => {
  const d = emptyDraft(false);
  const r = applyOperation(d, { kind: "SET_START", patch: { wording: "USAID" } });
  assert.equal(r.ok, true);
  assert.equal(r.draft.extras.start.wording, "USAID");
  assert.equal(applyOperation(r.draft, { kind: "SET_START", patch: { wording: "NOPE" } }).ok, false);
  const cleared = applyOperation(r.draft, { kind: "SET_START", patch: { wording: "" } });
  assert.equal(cleared.draft.extras.start.wording, undefined);
});

test("52.5: a result's reasoning and assumptions are set and cleared by the person, one field at a time", () => {
  const d = emptyDraft(false);
  d.proposal.logframe = [node("OUTCOME", "OC1", null)];
  const set = applyResultOperation(d.proposal, { kind: "EDIT_NODE_LOGIC", path: "logframe.0", rationale: " Feeding lowers wasting ", assumptions: "Food is available" });
  assert.equal(set.ok, true);
  assert.equal(set.proposal.logframe[0].value.rationale, "Feeding lowers wasting");
  assert.equal(set.proposal.logframe[0].status, "EDITED");
  const kept = applyResultOperation(set.proposal, { kind: "EDIT_NODE_LOGIC", path: "logframe.0", assumptions: "" });
  assert.equal(kept.proposal.logframe[0].value.assumptions, null);
  assert.equal(kept.proposal.logframe[0].value.rationale, "Feeding lowers wasting");
  assert.equal(applyResultOperation(d.proposal, { kind: "EDIT_NODE_LOGIC", path: "logframe.9", rationale: "x" }).ok, false);
});

test("52.5: a result without reasoning is advice only: shown, never an open gap, never a launch blocker", () => {
  const d = emptyDraft(false);
  d.proposal.logframe = [node("OUTCOME", "OC1", null), node("OUTPUT", "OP1", "OC1", { rationale: "Wells give water" })];
  const results = evaluateRequirements(d, SETUP_REQUIREMENTS);
  const advice = adviceNotes(results).filter((a) => a.key === "results.reasoning");
  assert.deepEqual(advice.map((a) => [a.key, a.code, a.params.count]), [["results.reasoning", "resultsWithoutReasoning", 1]]);
  assert.equal(openRequirements(results).some((g) => g.key === "results.reasoning"), false);
  d.proposal.logframe[0].value.rationale = "Because";
  assert.equal(adviceNotes(evaluateRequirements(d, SETUP_REQUIREMENTS)).filter((a) => a.key === "results.reasoning").length, 0);
});

test("52.5: the logframe sheet adds Assumptions and Rationale columns only when a result has them", () => {
  const d = emptyDraft(false);
  d.proposal.logframe = [node("OUTCOME", "OC1", null)];
  assert.match(logframeSheet(d.proposal).text.split("\n")[0], /^Level\tCode\tTitle\tDescription$/);
  d.proposal.logframe = [node("OUTCOME", "OC1", null, { assumptions: "Food is available", rationale: "Because" })];
  const sheet = logframeSheet(d.proposal).text.split("\n");
  assert.equal(sheet[0], "Level\tCode\tTitle\tDescription\tAssumptions\tRationale");
  assert.match(sheet[1], /Food is available\tBecause$/);
});

test("52.4: only non-default wording counts as the donor's words", () => {
  assert.equal(isDefaultVocabulary(DEFAULT_VOCABULARY), true);
  assert.equal(isDefaultVocabulary(presetVocabulary("FCDO")), false);
  assert.equal(isDefaultVocabulary(presetVocabulary("UN")), false);
});
