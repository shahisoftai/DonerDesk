import assert from "node:assert/strict";
import test from "node:test";
import { LlmReportDraftGenerator } from "../dist/llm/llm-report-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";
import { parseSections } from "../dist/llm/llm-report-draft-generator.js";

const input = {
  reportPlan: {
    id: "plan-1",
    tenantId: "t1",
    projectId: "p1",
    reportingPeriodId: "r1",
    version: 1,
    generatedBy: "INFERRED",
    sections: [{ templateSectionId: "s1", title: "Executive Summary", required: true }],
    style: { tone: "FORMAL", language: "en", formattingRules: [] },
  },
  verifiedFindings: [
    { indicatorId: "ind-1", indicatorCode: "IND-1", value: "10", unit: "sessions", calculationMethod: "SUM", reportingPeriodId: "r1", sourceRecordIds: [], qualityFlags: [], computedAt: new Date() },
  ],
  evidencePackages: [],
  activities: [],
  indicatorUpdates: [],
  reportingProfileSnapshot: { tone: "FORMAL", language: "en", rules: [] },
  generationRunId: "run-1",
};

function fakeProvider({ text, error }) {
  return {
    name: "minimax",
    model: "MiniMax-Text-01",
    promptVersion: "1",
    async complete() {
      if (error) throw error;
      return { text: text ?? "", usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

test("stub generator reports usedFallback=true", async () => {
  const stub = new StubReportDraftGenerator();
  const result = await stub.generateDraft(input);
  assert.equal(result.usedFallback, true);
  assert.ok(result.sections.length > 0);
});

test("LLM generator returns usedFallback=false on valid output", async () => {
  const provider = fakeProvider({
    text: JSON.stringify({ sections: [{ title: "Executive Summary", content: "Real AI narrative." }] }),
  });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, false);
  assert.equal(result.sections[0].content, "Real AI narrative.");
});

test("LLM generator returns usedFallback=true on provider error", async () => {
  const provider = fakeProvider({ error: new Error("timeout") });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, true);
  assert.ok(result.sections.length > 0);
});

test("LLM generator returns usedFallback=true on empty response", async () => {
  const provider = fakeProvider({ text: "" });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, true);
});

test("LLM generator returns usedFallback=true on unparseable output", async () => {
  const provider = fakeProvider({ text: "not json at all" });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, true);
});

test("parseSections parses valid output with claims", () => {
  const sections = parseSections(
    JSON.stringify({
      sections: [{ title: "A", content: "text", claims: [{ text: "c", type: "NUMERIC", proposedSources: [] }] }],
    }),
  );
  assert.ok(sections);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].claims[0].type, "NUMERIC");
});
