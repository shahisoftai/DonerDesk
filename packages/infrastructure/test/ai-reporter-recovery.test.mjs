import assert from "node:assert/strict";
import test from "node:test";
import { AiReporterDraftGenerator, isTimeoutError } from "../dist/llm/ai-reporter-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";

/**
 * Phase 25.1 — a draft the AI got wrong is recovered once, automatically; if it still fails the section says why.
 * The scripted writer below is the "fake AI writer" of 25.0: each behaviour is a function of the attempt number.
 */

const finding = { indicatorId: "ind-1", indicatorCode: "OUT-1", indicatorName: "Centres", value: "96", target: "120", unit: "centres", calculationMethod: "SUM:increase:period", qualityFlags: [], performanceEvaluation: { type: "POSITIVE" } };
const sec = (title) => ({ templateSectionId: title, title, inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] });
const input = (over = {}) => ({
  reportPlan: { tenantId: "t", sections: [sec("Progress")] },
  verifiedFindings: [finding],
  evidencePackages: [],
  activities: [],
  indicatorUpdates: [],
  reportingProfileSnapshot: {},
  generationRunId: "run-1",
  draftedSections: [{ title: "Results", content: "Results text." }],
  ...over,
});

const good = { sectionId: "s", title: "Progress", content: "The project reached 96 centres.", claims: [], sourceReferences: [], telemetry: { inputTokens: 5, outputTokens: 6, validatorIssues: [], qualityWarnings: [] } };
const rejected = { ...good, content: "The project reached 33.3% of 26.2 centres.", telemetry: { usedFallback: true, fallbackReason: "VALIDATOR_FAILED", validatorIssues: ["UNGROUNDED_NUMBER: 33.3, 26.2 do not appear in the verified inputs; quote only recorded figures"] } };

function scripted(...steps) {
  const calls = [];
  return {
    calls,
    async draftSection(request) {
      calls.push(request);
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      return step.error ? { ok: false, error: { message: step.error } } : { ok: true, value: step };
    },
    async rewriteSection() { throw new Error("unused"); },
    async health() { return { ok: true, value: { ok: true } }; },
  };
}
const generator = (worker) => new AiReporterDraftGenerator(worker, new StubReportDraftGenerator(), undefined, undefined, undefined, undefined, 4, { provider: "openai", model: "m" });
const run = (worker, over) => generator(worker).generateSection(input(over), sec("Progress"));

test("a rejected figure is recovered by one retry that names it", async () => {
  const worker = scripted(rejected, good);
  const result = await run(worker);
  assert.equal(result.usedFallback, false);
  assert.equal(worker.calls.length, 2);
  assert.equal(result.telemetry.attempts, 2);
  const retried = worker.calls[1].section.userInstruction;
  assert.match(retried, /Do not state 33\.3, 26\.2\./);
  assert.match(retried, /recorded inputs/);
  assert.equal(worker.calls[0].section.userInstruction, undefined);
});

test("an author instruction survives the recovery instruction", async () => {
  const worker = scripted(rejected, good);
  await run(worker, { sectionInstruction: "Mention the clinic" });
  assert.match(worker.calls[1].section.userInstruction, /^Mention the clinic\n\nDo not state/);
});

test("a figure that is still wrong after the retry is labelled, never silent, and bounded to two calls", async () => {
  const worker = scripted(rejected);
  const result = await run(worker);
  assert.equal(worker.calls.length, 2, "exactly one automatic retry");
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "VALIDATOR_FAILED");
  assert.equal(result.fallbackDetail, "figures not in your data: 33.3, 26.2");
  assert.equal(result.telemetry.attempts, 2);
  assert.doesNotMatch(result.fallbackDetail, /UNGROUNDED/);
});

test("a provider failure is retried once with a shorter brief, then recovers", async () => {
  const worker = scripted({ error: "AI Reporter returned 504 for /v1/ai-reporter/section (url=x)" }, good);
  const result = await run(worker);
  assert.equal(result.usedFallback, false);
  assert.equal(worker.calls.length, 2);
  assert.deepEqual(worker.calls[1].section.priorSectionsSummary, [], "the other sections' summaries are left out");
  assert.ok(worker.calls[0].section.priorSectionsSummary.length > 0);
});

test("a timeout is labelled as one when the retry also fails", async () => {
  const worker = scripted({ error: "AI Reporter request failed (url=x): The operation was aborted due to timeout" });
  const result = await run(worker);
  assert.equal(worker.calls.length, 2);
  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "PROVIDER_TIMEOUT");
  assert.equal(result.fallbackDetail, undefined);
});

test("an HTTP error that is not a timeout keeps its own reason", async () => {
  const result = await run(scripted({ error: "AI Reporter returned 500 for /v1/ai-reporter/section (url=x)" }));
  assert.equal(result.fallbackReason, "PROVIDER_HTTP_ERROR");
});

test("an empty reply is retried and labelled", async () => {
  const worker = scripted({ ...good, content: "  " });
  const result = await run(worker);
  assert.equal(worker.calls.length, 2);
  assert.equal(result.fallbackReason, "PROVIDER_EMPTY_RESPONSE");
});

test("a clean draft is one call, one attempt", async () => {
  const worker = scripted(good);
  const result = await run(worker);
  assert.equal(worker.calls.length, 1);
  assert.equal(result.telemetry.attempts, 1);
  assert.equal(result.fallbackReason, undefined);
});

test("timeout wording", () => {
  for (const m of ["The operation was aborted due to timeout", "request timed out", "AI Reporter returned 504 for x", "AI Reporter returned 408 for x"]) assert.equal(isTimeoutError(m), true, m);
  for (const m of ["AI Reporter returned 500 for x", "AI Reporter returned 5040 for x", "connect ECONNREFUSED"]) assert.equal(isTimeoutError(m), false, m);
});
