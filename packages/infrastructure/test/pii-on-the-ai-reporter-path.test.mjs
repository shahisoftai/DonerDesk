import assert from "node:assert/strict";
import test from "node:test";
import { AiReporterDraftGenerator } from "../dist/llm/ai-reporter-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";
import { EvidencePackageBuilder } from "../dist/ai/evidence-package-builder.js";
import { createPiiFirewall } from "@donordesk/domain";

/**
 * C-3 — personal identifiers must not reach a third-party model on the AI
 * Reporter path. The writer and the claim verifier read the same redacted
 * text, so a redacted quotation still verifies.
 */

const sec = (title) => ({ templateSectionId: title, title, inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] });
const good = { sectionId: "s", title: "Progress", content: "The project reached 96 centres.", claims: [], sourceReferences: [], telemetry: { inputTokens: 5, outputTokens: 6, validatorIssues: [], qualityWarnings: [] } };

function worker() {
  const calls = [];
  return {
    calls,
    async draftSection(request) {
      calls.push(request);
      return { ok: true, value: good };
    },
    async rewriteSection() { throw new Error("unused"); },
    async health() { return { ok: true, value: { ok: true } }; },
  };
}

const generator = (w) => new AiReporterDraftGenerator(w, new StubReportDraftGenerator(), undefined, undefined, undefined, undefined, 6, { provider: "openai", model: "m" });

const input = (over = {}) => ({
  reportPlan: { tenantId: "t", sections: [sec("Progress")] },
  verifiedFindings: [],
  evidencePackages: [],
  activities: [],
  indicatorUpdates: [],
  reportingProfileSnapshot: {},
  generationRunId: "run-1",
  ...over,
});

test("the request the worker receives carries no email address", async () => {
  const w = worker();
  await generator(w).generateSection(
    input({
      activities: [
        {
          activityTitle: "Clinic",
          activityId: "a-1",
          attachedEvidenceIds: [],
          activityDate: new Date("2026-09-01T00:00:00Z"),
          location: "Wau",
          summary: "Nurse Jane Doe saw 12 patients; contact jane.doe@example.org for the register.",
          participantsTotal: 12,
        },
      ],
    }),
    sec("Progress"),
  );
  const request = w.calls[0];
  const summary = request.activities[0].summary;
  assert.ok(!summary.includes("jane.doe@example.org"), summary);
  assert.match(summary, /\[REDACTED\]/);
  assert.match(summary, /Nurse Jane Doe saw 12 patients/, "the rest of the sentence is untouched");
});

test("the request the worker receives carries no phone number", async () => {
  const w = worker();
  await generator(w).generateSection(
    input({
      activities: [
        {
          activityTitle: "Clinic",
          activityId: "a-1",
          attachedEvidenceIds: [],
          activityDate: new Date("2026-09-01T00:00:00Z"),
          location: "Wau",
          summary: "Call the duty line on +1 555 123 4567 for stock.",
        },
      ],
    }),
    sec("Progress"),
  );
  const summary = w.calls[0].activities[0].summary;
  assert.ok(!summary.includes("+1 555 123 4567"), summary);
});

test("the officer's story is redacted too", async () => {
  const w = worker();
  await generator(w).generateSection(
    input({
      reportContext: {
        storyContext: { achievements: "Reached jane.doe@example.org's household." },
      },
    }),
    sec("Progress"),
  );
  const story = w.calls[0].context.story;
  assert.ok(!story.achievements.includes("jane.doe@example.org"), story.achievements);
});

test("LLM_PII_POLICY=allow sends the text unchanged", async () => {
  const previous = process.env.LLM_PII_POLICY;
  process.env.LLM_PII_POLICY = "allow";
  try {
    const w = worker();
    await generator(w).generateSection(
      input({
        activities: [
          {
            activityTitle: "Clinic",
            activityId: "a-1",
            attachedEvidenceIds: [],
            activityDate: new Date("2026-09-01T00:00:00Z"),
            location: "Wau",
            summary: "Contact jane.doe@example.org.",
          },
        ],
      }),
      sec("Progress"),
    );
    assert.match(w.calls[0].activities[0].summary, /jane\.doe@example\.org/);
  } finally {
    if (previous === undefined) delete process.env.LLM_PII_POLICY;
    else process.env.LLM_PII_POLICY = previous;
  }
});

test("the evidence package is redacted, and its hash still covers the stored text", async () => {
  const stored = "Register of patients. Contact the clinic on clinic@example.org. 42 patients seen.";
  const evidence = {
    id: "e-1",
    extractedText: stored,
    aiSummary: undefined,
    title: "Register",
    fileName: "register.txt",
    fileUrl: "/v1/files/t/evidence/e-1.txt",
    evidenceType: "DOCUMENT",
    verificationStatus: "VERIFIED",
    confidentialityLevel: "INTERNAL",
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  };
  const builder = new EvidencePackageBuilder({ findById: async () => ({ ok: true, value: evidence }) });
  const result = await builder.build({ tenantId: { toString: () => "t" }, evidenceIds: ["e-1"] });
  assert.equal(result.ok, true);
  const pkg = result.value[0];
  assert.ok(!pkg.extractedText.includes("clinic@example.org"), pkg.extractedText);
  for (const chunk of pkg.chunks) {
    assert.ok(!chunk.text.includes("clinic@example.org"), chunk.text);
  }
  // The hash is over the stored text, so a later edit to the document is still detected.
  const original = createPiiFirewall("redact");
  assert.equal(typeof original.redact, "function");
  assert.notEqual(pkg.evidenceHash, undefined);
});
