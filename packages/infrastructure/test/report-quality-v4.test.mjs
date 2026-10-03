import assert from "node:assert/strict";
import test from "node:test";
import { AiReporterDraftGenerator } from "../dist/llm/ai-reporter-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";
import { buildDraftedSectionsBlock } from "../dist/llm/llm-report-draft-generator.js";
import { allowedNumbers, ungroundedNumbers } from "../dist/ai/number-grounding.js";
import { assessDonorVoice } from "../dist/ai/donor-voice.js";
import { findBannedPhrases, runAll } from "../dist/ai/artifact-validators.js";
import { systemPrompt, WRITER_CONTRACT_VERSION } from "../dist/llm/ai-reporter/contract.js";

/**
 * Report-quality v4 — the AI Reporter adapter now sends the editorial context
 * the legacy narrator already had, drafts the executive summary from drafted
 * sections, retrieves section-relevant evidence, and honours the worker's
 * VALIDATOR_FAILED signal instead of shipping ungrounded prose as AI output.
 */

const finding = {
  indicatorId: "ind-1",
  indicatorCode: "OUT-1",
  indicatorName: "Learning centres rehabilitated",
  value: "96",
  target: "120",
  comparisonValue: "60",
  unit: "centres",
  calculationMethod: "SUM:increase:period",
  qualityFlags: [],
  performanceEvaluation: { type: "POSITIVE" },
};

function section(title, extra = {}) {
  return { templateSectionId: title, title, inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [], ...extra };
}

function buildInput(overrides = {}) {
  return {
    reportPlan: { tenantId: "t-1", sections: [section("Executive Summary")] },
    verifiedFindings: [finding],
    evidencePackages: [
      { evidenceId: "ev-photo", title: "Site photo", fileName: "p.jpg", evidenceType: "PHOTO", verificationStatus: "PENDING", confidentialityLevel: "PUBLIC", chunks: [{ chunkId: "ev-photo:0", text: "Photograph of a painted wall." }] },
      { evidenceId: "ev-att", title: "Attendance register", fileName: "a.pdf", evidenceType: "REPORT", verificationStatus: "VERIFIED", confidentialityLevel: "PUBLIC", chunks: [{ chunkId: "ev-att:0", text: "Attendance register: 142 caregivers attended IYCF counselling sessions." }] },
    ],
    activities: [{ activityId: "act-14", activityTitle: "IYCF counselling", activityDate: new Date("2026-05-02"), participantsTotal: 142, summary: "Counselling sessions held.", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], status: "COMPLETED" }],
    indicatorUpdates: [{ indicatorId: "ind-1", indicatorCode: "OUT-1", periodAchievement: "96", cumulativeAchievement: "96", attachedEvidenceIds: [], verificationStatus: "VERIFIED" }],
    reportingProfileSnapshot: { tone: "FORMAL", language: "English", formattingRules: [], sectionOverrides: {} },
    generationRunId: "run-1",
    reportContext: {
      project: { title: "Nutrition", projectCode: "N1", donorName: "European Union", implementingOrganization: "NGO", country: "AF", sector: "Nutrition", startDate: "2026-01-01", endDate: "2026-12-31", reportingFrequency: "QUARTERLY" },
      period: { reportType: "QUARTERLY", startDate: "2026-04-01", endDate: "2026-06-30" },
      storyContext: { varianceExplanations: "Rains delayed construction in two districts." },
    },
    ...overrides,
  };
}

function fakeWorker(response) {
  const calls = [];
  return {
    calls,
    async draftSection(request) {
      calls.push(request);
      return { ok: true, value: typeof response === "function" ? response(request) : response };
    },
    async rewriteSection() {
      throw new Error("unused");
    },
    async health() {
      return { ok: true, value: { ok: true } };
    },
  };
}

function generator(worker) {
  return new AiReporterDraftGenerator(worker, new StubReportDraftGenerator(), undefined, undefined, undefined, undefined, 4, { provider: "openai", model: "m" });
}

const okResponse = {
  sectionId: "s",
  title: "Executive Summary",
  content: "The project rehabilitated 96 learning centres, 80% of its target, up from 60 in the previous period.",
  claims: [],
  sourceReferences: [{ type: "indicator", id: "ind-1", label: "OUT-1" }],
  telemetry: { inputTokens: 10, outputTokens: 20, validatorIssues: [], qualityWarnings: [] },
};

test("v4: the worker brief carries section guidance, story, visibility, ids, and synthesis context", async () => {
  const worker = fakeWorker(okResponse);
  const input = buildInput({
    draftedSections: [
      { title: "Results", content: "The project rehabilitated 96 learning centres.\n| Code | Value |\n| --- | --- |" },
      { title: "Executive Summary", content: "stale self" },
    ],
  });
  const result = await generator(worker).generateSection(input, input.reportPlan.sections[0]);
  assert.equal(result.usedFallback, false);
  const req = worker.calls[0];
  assert.ok(req.section.sectionGuidance.some((g) => g.includes("flowing paragraphs")), "exec-summary guidance reaches the worker");
  assert.equal(req.section.synthesis, true);
  assert.deepEqual(req.section.priorSectionsSummary, ["## Results\nThe project rehabilitated 96 learning centres."], "siblings only, tables stripped");
  assert.equal(req.context.story.varianceExplanations, "Rains delayed construction in two districts.");
  assert.ok(req.context.visibility.length > 0, "donor attribution lines are sent");
  assert.equal(req.verifiedFindings[0].indicatorId, "ind-1");
  assert.equal(req.activities[0].activityId, "act-14");
});

test("v4: retrieval ranks section-relevant evidence first instead of the first packages", async () => {
  const worker = fakeWorker({ ...okResponse, title: "Caregiver counselling" });
  const input = buildInput();
  const sec = section("Caregiver counselling", { evidenceNeeds: ["attendance register for IYCF counselling"] });
  await generator(worker).generateSection(input, sec);
  const evidence = worker.calls[0].retrievedEvidence;
  assert.equal(evidence[0].evidenceId, "ev-att");
  assert.equal(new Set(evidence.flatMap((e) => e.chunks.map((c) => c.chunkId))).size, evidence.flatMap((e) => e.chunks).length, "no duplicate chunks");
});

test("v4: worker VALIDATOR_FAILED uses the deterministic section and reports the fallback", async () => {
  const worker = fakeWorker({
    ...okResponse,
    content: "The project reached 5,000 households.",
    telemetry: { usedFallback: true, fallbackReason: "VALIDATOR_FAILED", validatorIssues: ["UNGROUNDED_NUMBER: 5,000"] },
  });
  const input = buildInput();
  const result = await generator(worker).generateSection(input, input.reportPlan.sections[0]);
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "VALIDATOR_FAILED");
  assert.ok(!result.section.content.includes("5,000"), "ungrounded prose never reaches the report");
  assert.equal(result.telemetry.parseOutcome, "VALIDATOR_FAILED");
  assert.deepEqual(result.telemetry.qualityIssues, ["UNGROUNDED_NUMBER: 5,000"]);
});

test("v4: style-only issues keep the AI prose but are recorded", async () => {
  const worker = fakeWorker({ ...okResponse, telemetry: { validatorIssues: ["BANNED_PHRASE: remarkable"], qualityWarnings: [] } });
  const input = buildInput();
  const result = await generator(worker).generateSection(input, input.reportPlan.sections[0]);
  assert.equal(result.usedFallback, false);
  assert.equal(result.telemetry.parseOutcome, "VALID_WITH_ISSUES");
  assert.ok(result.telemetry.qualityIssues.includes("BANNED_PHRASE: remarkable"));
});

test("v4: legacy narrator gets drafted siblings (synthesis vs avoid-repeat)", () => {
  const input = buildInput({ draftedSections: [{ title: "Results", content: "The project rehabilitated 96 centres." }] });
  const summary = buildDraftedSectionsBlock(input, section("Executive Summary")).join("\n");
  assert.match(summary, /Drafted report sections to synthesise/);
  const other = buildDraftedSectionsBlock(input, section("Challenges")).join("\n");
  assert.match(other, /do NOT restate/);
  assert.deepEqual(buildDraftedSectionsBlock(buildInput(), section("Challenges")), []);
});

test("v4: number grounding allows recorded figures and percent of target only", () => {
  const allowed = allowedNumbers({ activities: [{ participantsTotal: 142 }], note: "3,251 people" }, [finding]);
  assert.deepEqual(ungroundedNumbers("96 centres (80% of target), up from 60; 142 caregivers; 3251 people; OUT-1\n1. item", allowed), []);
  assert.deepEqual(ungroundedNumbers("The project reached 5,000 households.", allowed), ["5,000"]);
  const result = runAll({ sectionId: "s", title: "R", content: "The project reached 5,000 households.", claims: [], sourceReferences: [] }, { allowedNumbers: allowed });
  assert.match(result.issues.join(" "), /UNGROUNDED_NUMBER/);
});

test("v4: banned phrases match whole words; donor voice flags passive/topic openings", () => {
  assert.deepEqual(findBannedPhrases("The project hired permanent staff."), []);
  assert.deepEqual(findBannedPhrases("Results were remarkable."), ["remarkable"]);
  const voice = assessDonorVoice("Regarding health, sessions were held. Kits were distributed. It is worth noting the rain.");
  assert.ok(voice.score < 1);
  assert.match(voice.warnings.join(" "), /VOICE_PASSIVE/);
  assert.match(voice.warnings.join(" "), /VOICE_TOPIC_OPENING/);
});

test("v4: contract version and prompt state the enforced number rule", () => {
  assert.equal(WRITER_CONTRACT_VERSION, 4);
  assert.match(systemPrompt(4), /percent of target/);
  assert.match(systemPrompt(3), /dramatically, permanent, fully achieved/);
});

test("number grounding: a written date is grounded against an ISO date in the inputs (TS mirror)", async () => {
  const { allowedNumbers, ungroundedNumbers } = await import("../dist/ai/number-grounding.js");
  const allowed = allowedNumbers({ activities: [{ date: "2028-04-20", total: 600 }, { date: "2028-03-12" }] });
  assert.deepEqual(ungroundedNumbers("Held on 20 April 2028 and April 20th, 2028 and 12 March.", allowed), []);
  assert.deepEqual(ungroundedNumbers("Held on 21 April 2028.", allowed), ["21"]);
  assert.deepEqual(ungroundedNumbers("It reached 20 people.", allowed), ["20"]);
  assert.deepEqual(ungroundedNumbers("On 20 April 2028 it reached 600.", allowedNumbers({ total: 600 })), ["20", "2028"]);
});
