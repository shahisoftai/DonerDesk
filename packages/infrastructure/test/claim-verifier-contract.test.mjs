import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";

function finding(overrides = {}) {
  return {
    indicatorId: "ind-1",
    indicatorCode: "IND-1",
    value: "30",
    unit: "people",
    reportingPeriodId: "period-1",
    qualityFlags: [],
    ...overrides,
  };
}

function pkg(text, overrides = {}) {
  return {
    evidenceId: "e-1",
    title: "Evidence",
    fileName: "e.pdf",
    evidenceType: "MONITORING_REPORT",
    verificationStatus: "VERIFIED",
    confidentialityLevel: "INTERNAL",
    chunks: [{ chunkId: "e-1:0", text, tokenCount: 10, chunkIndex: 0 }],
    evidenceHash: "hash-a",
    evidenceUpdatedAt: new Date(),
    chunkerVersion: "v1",
    ...overrides,
  };
}

/**
 * Shared contract for every IClaimVerifier implementation (LSP). Any adapter,
 * deterministic or LLM-backed, must never return a stronger assurance level
 * than the pipeline permits. A new verifier that violates one of these cannot
 * be substituted.
 */
async function runClaimVerifierContract(verifier) {
  // Causality is never auto-approved.
  const causal = await verifier.verify({
    claim: { text: "The training caused the increase in attendance", type: "CAUSAL", proposedSources: [] },
    findings: [],
    evidencePackages: [pkg("The training caused the increase in attendance")],
  });
  assert.ok(causal.ok);
  assert.notEqual(causal.value.result, "PASSED");

  // Numeric contradiction never passes.
  const contradiction = await verifier.verify({
    claim: { text: "99 people were reached in this period", type: "NUMERIC", proposedSources: [] },
    findings: [finding({ value: "30" })],
    evidencePackages: [],
  });
  assert.ok(contradiction.ok);
  assert.notEqual(contradiction.value.result, "PASSED");

  // Confidential evidence never passes without authorization.
  const confidential = await verifier.verify({
    claim: { text: "Sensitive outreach was delivered", type: "QUALITATIVE", proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "sensitive details" }] },
    findings: [],
    evidencePackages: [pkg("Sensitive outreach was delivered", { confidentialityLevel: "HIGHLY_SENSITIVE" })],
  });
  assert.ok(confidential.ok);
  assert.notEqual(confidential.value.result, "PASSED");

  // Unrelated evidence never makes an unrelated claim pass.
  const unrelated = await verifier.verify({
    claim: { text: "Programmatic impact was independently verified by an external evaluator", type: "FACTUAL", proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "Attendance sheets were collected" }] },
    findings: [],
    evidencePackages: [pkg("Attendance sheets were collected for the training")],
  });
  assert.ok(unrelated.ok);
  assert.notEqual(unrelated.value.result, "PASSED");

  // Mutated evidence hash never passes.
  const mutated = await verifier.verify({
    claim: { text: "Training sessions were delivered to 45 participants", type: "FACTUAL", proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "Training sessions were delivered to 45 participants", evidenceHash: "stale" }] },
    findings: [],
    evidencePackages: [pkg("Training sessions were delivered to 45 participants", { evidenceHash: "current" })],
  });
  assert.ok(mutated.ok);
  assert.notEqual(mutated.value.result, "PASSED");
}

test("DeterministicClaimVerifier satisfies the claim-verifier contract", async () => {
  await runClaimVerifierContract(new DeterministicClaimVerifier());
});

test("a never-passing stub verifier also satisfies the contract (no stronger assurance)", async () => {
  const stub = {
    async verify() {
      return { ok: true, value: { claimId: "", result: "FAILED", detail: "stub never passes", tierUsed: 5, reasonCodes: ["ENTAILMENT_UNCERTAIN"] } };
    },
  };
  await runClaimVerifierContract(stub);
});
