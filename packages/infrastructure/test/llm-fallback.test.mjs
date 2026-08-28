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

test("section generation returns real provider usage and parse telemetry", async () => {
  const provider = fakeProvider({
    text: JSON.stringify({ sections: [{ title: "Executive Summary", content: "Grounded narrative." }] }),
  });
  provider.complete = async () => ({
    text: JSON.stringify({ sections: [{ title: "Executive Summary", content: "Grounded narrative." }] }),
    model: provider.model,
    promptVersion: provider.promptVersion,
    usage: { inputTokens: 123, outputTokens: 45 },
  });
  const result = await new LlmReportDraftGenerator(provider).generateSection(input, input.reportPlan.sections[0]);
  assert.equal(result.usedFallback, false);
  assert.equal(result.telemetry.inputTokens, 123);
  assert.equal(result.telemetry.outputTokens, 45);
  assert.equal(result.telemetry.parseOutcome, "VALID");
  assert.equal(result.telemetry.promptHash.length, 64);
  assert.equal(result.telemetry.responseHash.length, 64);
});

test("section prompt represents a missing denominator as unknown and forbids invented plans", async () => {
  let captured;
  const provider = fakeProvider({});
  provider.complete = async (request) => {
    captured = request;
    return {
      text: JSON.stringify({ sections: [{ title: "Executive Summary", content: "The percentage could not be calculated." }] }),
      model: provider.model,
      promptVersion: provider.promptVersion,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
  const missingInput = {
    ...input,
    verifiedFindings: [{ ...input.verifiedFindings[0], value: "0", qualityFlags: ["MISSING_DENOMINATOR"] }],
  };
  await new LlmReportDraftGenerator(provider).generateSection(missingInput, input.reportPlan.sections[0]);
  assert.match(captured.userPrompt, /"value":null/);
  assert.match(captured.userPrompt, /"valueStatus":"NOT_CALCULABLE"/);
  assert.match(captured.userPrompt, /Never write it as zero/);
  assert.match(captured.systemPrompt, /MUST NOT invent causes, challenges, mitigations/);
});

test("section prompt ranks directly linked evidence ahead of unrelated files", async () => {
  let captured;
  const provider = fakeProvider({});
  provider.complete = async (request) => {
    captured = request;
    return {
      text: JSON.stringify({ sections: [{ title: "Progress Against Indicators", content: "Grounded progress." }] }),
      model: provider.model,
      promptVersion: provider.promptVersion,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
  const evidencePackages = ["unrelated-1", "unrelated-2", "unrelated-3", "unrelated-4", "linked"].map((id) => ({
    evidenceId: id,
    title: id === "linked" ? "Verified indicator register" : `Unrelated photo ${id}`,
    fileName: `${id}.txt`,
    evidenceType: id === "linked" ? "MONITORING_DATA" : "PHOTO",
    verificationStatus: "VERIFIED",
    confidentialityLevel: "INTERNAL",
    extractedText: id,
    chunks: [{ chunkId: `${id}:0`, text: id, tokenCount: 1, chunkIndex: 0 }],
    evidenceHash: id,
    evidenceUpdatedAt: new Date(),
    chunkerVersion: "v1",
  }));
  const rankedInput = {
    ...input,
    evidencePackages,
    indicatorUpdates: [{
      indicatorId: "ind-1",
      indicatorCode: "IND-1",
      periodAchievement: "10",
      cumulativeAchievement: "10",
      attachedEvidenceIds: ["linked"],
      verificationStatus: "VERIFIED",
    }],
  };
  const section = { ...input.reportPlan.sections[0], title: "Progress Against Indicators", evidenceNeeds: ["Indicator values with evidence"] };
  await new LlmReportDraftGenerator(provider).generateSection(rankedInput, section);
  const evidenceBlock = captured.userPrompt.split("# Evidence Packages\n")[1].split("\n\n# Instructions")[0];
  assert.ok(evidenceBlock.includes('"evidenceId":"linked"'));
  assert.ok(!evidenceBlock.includes('"evidenceId":"unrelated-4"'));
});

test("sections with no authoritative narrative inputs skip the provider and disclose the gap", async () => {
  let calls = 0;
  const provider = fakeProvider({});
  provider.complete = async () => {
    calls += 1;
    throw new Error("provider must not be called");
  };
  const generator = new LlmReportDraftGenerator(provider);
  for (const title of ["Activities Completed", "Challenges and Mitigations", "Lessons Learned", "Plan for Next Period"]) {
    const result = await generator.generateSection(input, { ...input.reportPlan.sections[0], title });
    assert.equal(result.usedFallback, false);
    assert.equal(result.deterministicReason, "INSUFFICIENT_INPUT");
    assert.equal(result.telemetry.parseOutcome, "INSUFFICIENT_INPUT");
    assert.equal(result.section.claims.length, 0, title);
    assert.match(result.section.content, /No (activity records|challenges|lessons learned|approved next-period actions)/i);
  }
  assert.equal(calls, 0);
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

test("LLM generator is lenient for prose output (no JSON wrapper) and does not fall back", async () => {
  // Strict-JSON parsing is deliberately lenient: if the LLM narrates directly
  // (MiniMax sometimes does), the entire response is taken as one narrative
  // section instead of silently falling back to the deterministic stub. This
  // matches the rewrite path's lenient behaviour and prevents a real AI draft
  // from being discarded in favour of stub tables.
  const provider = fakeProvider({ text: "not json at all, just narrative prose" });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, false);
  assert.equal(result.fallbackReason, undefined);
  assert.ok(result.sections.length > 0);
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

test("parseSections falls back to narrative when LLM narrates directly (no JSON)", () => {
  const sections = parseSections(
    "Narrative text generated by the LLM as prose, not JSON.",
    [{ title: "Executive Summary" }],
  );
  assert.ok(sections);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Executive Summary");
  assert.ok(sections[0].content.startsWith("Narrative text"));
});

test("LLM generator returns fallbackReason=PROVIDER_TIMEOUT on AbortError", async () => {
  const provider = fakeProvider({
    error: Object.assign(new Error("request aborted"), { name: "AbortError" }),
  });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "PROVIDER_TIMEOUT");
});

test("LLM generator returns fallbackReason=PROVIDER_MALFORMED_RESPONSE on empty JSON arrays", async () => {
  // Empty `sections` array is the only "malformed" shape that still triggers
  // a fallback — the lenient parser otherwise treats prose as a single
  // narrative section. This guards against the LLM returning empty JSON.
  const provider = fakeProvider({
    text: JSON.stringify({ sections: [] }),
  });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "PROVIDER_MALFORMED_RESPONSE");
});

test("LLM generator accepts direct prose via lenient parse and avoids fallback", async () => {
  const provider = fakeProvider({
    text: "The reporting period saw 450 beneficiaries trained across 12 sessions.",
  });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.generateDraft(input);
  assert.equal(result.usedFallback, false);
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].content, "The reporting period saw 450 beneficiaries trained across 12 sessions.");
});

test("LLM rewrite returns fallbackUsed=true and fallbackReason on provider error", async () => {
  const provider = fakeProvider({ error: new Error("timeout") });
  const gen = new LlmReportDraftGenerator(provider);
  const result = await gen.rewriteSection({
    sectionTitle: "Executive Summary",
    content: "source text",
    mode: "REWRITE",
    audience: "DONOR",
    sourceReferences: [],
  });
  assert.equal(result.fallbackUsed, true);
  assert.ok(result.fallbackReason);
  assert.equal(result.content.length > 0, true);
});

test("LLM rewrite preserves caveats (does not strip [Needs verification] markers)", async () => {
  // The stub generator is the deterministic fallback; ensure it preserves
  // the Phase 6 invariant: caveat markers must never be silently removed.
  const stub = new StubReportDraftGenerator();
  const result = await stub.rewriteSection({
    sectionTitle: "Activities",
    content: "We trained 50 people. [Needs verification] Security protocols followed.",
    mode: "REWRITE",
    audience: "DONOR",
    sourceReferences: [],
  });
  assert.ok(result.content.includes("[Needs verification]"));
});
