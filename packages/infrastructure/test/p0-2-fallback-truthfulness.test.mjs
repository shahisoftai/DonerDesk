import assert from "node:assert/strict";
import test from "node:test";
import { LlmReportDraftGenerator } from "../dist/llm/llm-report-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";

/**
 * P0-2 — AI provenance and fallback truthfulness.
 * A section is labelled AI-generated only if a real AI provider produced the
 * persisted text. A fallback section must never be presented as AI, fallback
 * status must be immediately visible, and internal calculation/debug strings
 * must never appear in a user-facing report.
 */

function finding(overrides = {}) {
  return {
    indicatorId: "ind-1",
    indicatorCode: "OUT-1",
    indicatorName: "Number of learning centres established",
    value: "30",
    unit: "centres",
    calculationMethod: "SUM:neutral:period",
    target: "120",
    comparisonValue: undefined,
    performanceEvaluation: undefined,
    qualityFlags: ["MISSING_DISAGGREGATION"],
    ...overrides,
  };
}

function buildInput(findings = [finding()]) {
  return {
    reportPlan: { sections: [{ templateSectionId: "narrative", title: "Narrative Report", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] }] },
    verifiedFindings: findings,
    evidencePackages: [],
    activities: [],
    indicatorUpdates: findings.map((f) => ({ indicatorId: f.indicatorId, dataSource: "Field reports, HMIS data, learning assessments, community surveys", comments: null, periodAchievement: f.value, cumulativeAchievement: f.value, attachedEvidenceIds: [], verificationStatus: "VERIFIED" })),
    reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} },
    generationRunId: "run-1",
    reportContext: { project: { title: "P", projectCode: "P1" }, period: { reportType: "QUARTERLY" } },
  };
}

test("P0-2: forced provider failure falls back, is flagged usedFallback, and emits no internal debug strings", async () => {
  const throwingProvider = {
    name: "minimax",
    model: "minimax-text-01",
    complete: async () => {
      throw new Error("request timed out");
    },
  };
  const generator = new LlmReportDraftGenerator(throwingProvider, new StubReportDraftGenerator());
  const result = await generator.generateSection(buildInput(), buildInput().reportPlan.sections[0]);

  assert.equal(result.usedFallback, true, "provider failure must set usedFallback");
  assert.ok(result.fallbackReason, "fallback reason must be surfaced");
  const content = result.section.content;
  assert.ok(!content.includes("recorded via"), "must not expose 'recorded via'");
  assert.ok(!content.includes("SUM:neutral"), "must not expose calculationMethod debug string");
  assert.ok(!content.includes("MISSING_DISAGGREGATION"), "must not expose raw quality-flag codes");
  assert.ok(content.includes("recorded for the period"), "clean donor prose must be emitted");
  assert.ok(content.includes("disaggregated data was not recorded"), "caveat must be donor-friendly");
});

test("P0-2: the deterministic stub is never an AI model and its prose is donor-clean", async () => {
  const stub = new StubReportDraftGenerator();
  assert.equal(stub.model.modelId, "stub", "stub modelId must be 'stub' so it is never counted as AI");

  const result = await stub.generateSection(buildInput(), buildInput().reportPlan.sections[0]);
  assert.equal(result.usedFallback, true);
  const content = result.section.content;
  assert.ok(!content.includes("SUM:neutral"), "no internal calculation string");
  assert.ok(!content.includes("MISSING_DISAGGREGATION"), "no raw flag codes");
  assert.ok(content.includes("recorded for the period"), "clean prose");
});

test("P0-2: a clean provider response is NOT flagged as fallback (no false positive)", async () => {
  const cleanProvider = {
    name: "minimax",
    model: "minimax-text-01",
    complete: async () => ({
      text: JSON.stringify({ sections: [{ title: "Narrative Report", content: "The project delivered 30 centres during the period.", claims: [], sourceReferences: [] }] }),
      usage: { inputTokens: 10, outputTokens: 5 },
    }),
  };
  const generator = new LlmReportDraftGenerator(cleanProvider, new StubReportDraftGenerator());
  const result = await generator.generateSection(buildInput(), buildInput().reportPlan.sections[0]);
  assert.equal(result.usedFallback, false, "clean provider response must not be treated as fallback");
  assert.ok(result.section.content.includes("delivered 30 centres"));
});
