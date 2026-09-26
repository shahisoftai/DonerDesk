import assert from "node:assert/strict";
import test from "node:test";
import {
  LANGUAGE_CRAFT_RULES,
  buildRequirementGuidanceBlock,
  buildSectionSpecificGuidance,
  buildSystemPrompt,
} from "../dist/llm/llm-report-draft-generator.js";

/**
 * Quality remediation WS1–WS4 — deterministic prompt-bridge surfaces.
 */

test("system prompt carries the language-craft rules (WS2)", () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes("Language craft (mandatory):"));
  for (const rule of LANGUAGE_CRAFT_RULES) {
    assert.ok(prompt.includes(rule), `missing craft rule: ${rule}`);
  }
});

test("requirement guidance block renders guidance and mandatory-question rules (WS1)", () => {
  const lines = buildRequirementGuidanceBlock({
    requirementGuidance: ["Outcomes first, then delivery context."],
    mandatoryQuestions: ["Report any safeguarding or PSEA concerns and the actions taken."],
  });
  const text = lines.join("\n");
  assert.ok(text.includes("# Donor Requirement Guidance (mandatory)"));
  assert.ok(text.includes("- Outcomes first, then delivery context."));
  assert.ok(text.includes("* Report any safeguarding or PSEA concerns and the actions taken."));
  assert.ok(text.includes("state exactly what was not recorded"));
});

test("requirement guidance block is empty for unstamped sections (byte-identical prompts before)", () => {
  assert.deepEqual(buildRequirementGuidanceBlock({ requirementGuidance: [], mandatoryQuestions: [] }), []);
  assert.deepEqual(buildRequirementGuidanceBlock({}), []);
});

test("cross-cutting sections get theme-synthesis and no-totals guidance (WS4)", () => {
  const section = { title: "Protection & Gender Mainstreaming", inputType: "NARRATIVE", mandatoryQuestions: [] };
  const guidance = buildSectionSpecificGuidance(section, { reportContext: undefined });
  const text = guidance.join("\n");
  assert.ok(text.includes("Synthesize this section by theme"));
  assert.ok(text.includes("never total, merge, or re-aggregate recorded counts"));
  assert.ok(text.includes("disaggregated data was not recorded"));
});

test("financial sections get verbatim variance-explanation discipline (WS4)", () => {
  const section = { title: "Financial Expenditure", inputType: "NARRATIVE", mandatoryQuestions: [] };
  const guidance = buildSectionSpecificGuidance(section, { reportContext: undefined });
  const text = guidance.join("\n");
  assert.ok(text.includes("verbatim from the 'Tell the Story' narrative context"));
  assert.ok(text.includes("Never compute, derive, or restate variance figures"));
});

test("non cross-cutting sections do not receive the cross-cutting block", () => {
  const section = { title: "Executive Summary", inputType: "NARRATIVE", mandatoryQuestions: [] };
  const guidance = buildSectionSpecificGuidance(section, { reportContext: undefined });
  assert.ok(!guidance.join("\n").includes("re-aggregate recorded counts"));
});
