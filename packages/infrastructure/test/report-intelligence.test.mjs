import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";
import { EvidencePackageBuilder } from "../dist/ai/evidence-package-builder.js";
import { EvidenceFile, TenantId } from "@donordesk/domain";

const tenant = TenantId.create("tenant-a");

function makeFinding(overrides = {}) {
  return {
    indicatorId: "ind-1",
    indicatorCode: "IND-1",
    value: "30",
    unit: "people",
    qualityFlags: [],
    reportingPeriodId: "period-1",
    ...overrides,
  };
}

function makePackage(overrides = {}) {
  return {
    evidenceId: "e-1",
    title: "Attendance sheet",
    fileName: "attendance.pdf",
    evidenceType: "ATTENDANCE_SHEET",
    verificationStatus: "VERIFIED",
    confidentialityLevel: "INTERNAL",
    extractedText: "45 participants attended the training session.",
    chunks: [{ chunkId: "e-1:0", text: "45 participants attended the training session.", tokenCount: 8, chunkIndex: 0 }],
    evidenceHash: "abc123",
    evidenceUpdatedAt: new Date("2026-08-01"),
    chunkerVersion: "evidence-chunker-v1",
    ...overrides,
  };
}

test("numeric claims pass tier 1 when they match a verified finding exactly", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: { text: "30 people were reached in this period", type: "NUMERIC", proposedSources: [] },
    findings: [makeFinding()],
    evidencePackages: [],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "PASSED");
  assert.equal(result.ok && result.value.tierUsed, 1);
});

test("numeric claims fail tier 1 on contradiction", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: { text: "99 people were reached in this period", type: "NUMERIC", proposedSources: [] },
    findings: [makeFinding()],
    evidencePackages: [],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.ok(result.ok && result.value.reasonCodes.includes("VALUE_MISMATCH"));
  assert.equal(result.ok && result.value.detail.toLowerCase().includes("contradict"), false);
});

test("numeric claims over unresolved semantics never pass", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: { text: "30 people were reached in this period", type: "NUMERIC", proposedSources: [] },
    findings: [makeFinding({ qualityFlags: ["NEEDS_REVIEW"] })],
    evidencePackages: [],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.ok(result.ok && result.value.reasonCodes.includes("ENTITY_MISMATCH"));
});

test("factual claims pass when cited evidence supports the assertion", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: {
      text: "Training sessions were delivered",
      type: "FACTUAL",
      proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "Training sessions were delivered to 45 participants" }],
    },
    findings: [],
    evidencePackages: [makePackage({ extractedText: "Training sessions were delivered to 45 participants.", chunks: [{ chunkId: "e-1:0", text: "Training sessions were delivered to 45 participants.", tokenCount: 8, chunkIndex: 0 }] })],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "PASSED");
  assert.equal(result.ok && result.value.tierUsed, 4);
  assert.ok(result.ok && result.value.entailment?.verdict === "SUPPORTED");
});

test("factual claims fail when cited evidence does not support the assertion", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: {
      text: "Programmatic impact was independently verified",
      type: "FACTUAL",
      proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "45 participants attended the training session" }],
    },
    findings: [],
    evidencePackages: [makePackage()],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.ok(result.ok && (result.value.reasonCodes.includes("ENTAILMENT_FAILED") || result.value.reasonCodes.includes("ENTAILMENT_UNCERTAIN")));
});

test("claims over confidential sources fail until authorized", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: {
      text: "Sensitive outreach was delivered",
      type: "QUALITATIVE",
      proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "sensitive details" }],
    },
    findings: [],
    evidencePackages: [makePackage({ confidentialityLevel: "HIGHLY_SENSITIVE" })],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.ok(result.ok && result.value.reasonCodes.includes("CONFIDENTIALITY_RESTRICTED"));
});

test("evidence hash mismatches block verification deterministically", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: {
      text: "Training sessions were delivered to 45 participants",
      type: "FACTUAL",
      proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "Training sessions were delivered to 45 participants", evidenceHash: "stale-hash" }],
    },
    findings: [],
    evidencePackages: [makePackage({ evidenceHash: "current-hash" })],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.ok(result.ok && result.value.reasonCodes.includes("EVIDENCE_HASH_MISMATCH"));
});

test("causal claims with limited evidence require elevated review", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: {
      text: "The training caused the increase in attendance",
      type: "CAUSAL",
      proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "45 participants attended" }],
    },
    findings: [],
    evidencePackages: [makePackage()],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
  assert.equal(result.ok && result.value.tierUsed, 5);
});

test("claims with no attached source fail coverage", async () => {
  const verifier = new DeterministicClaimVerifier();
  const result = await verifier.verify({
    claim: { text: "We achieved broad impact", type: "QUALITATIVE", proposedSources: [] },
    findings: [],
    evidencePackages: [],
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.value.result, "FAILED");
});

test("EvidencePackageBuilder snapshots bytes and chunker version", async () => {
  const evidence = EvidenceFile.create({
    id: "e-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    fileName: "attendance.pdf",
    title: "Attendance sheet",
    fileUrl: "/v1/files/attendance.pdf",
    fileType: "application/pdf",
    fileSize: 10,
    evidenceType: "ATTENDANCE_SHEET",
    uploadedById: "user-1",
  });
  evidence.setAiSuggestions("Summary of the attendance sheet.", [], undefined);
  const repo = { findById: async () => ({ ok: true, value: evidence }) };
  const builder = new EvidencePackageBuilder(repo);
  const result = await builder.build({ tenantId: tenant, evidenceIds: ["e-1"] });
  assert.ok(result.ok);
  assert.ok(result.ok && result.value.length === 1);
  const pkg = result.ok ? result.value[0] : null;
  assert.equal(pkg?.chunkerVersion, "evidence-chunker-v1");
  assert.match(pkg?.evidenceHash ?? "", /^[0-9a-f]{64}$/);
  assert.ok((pkg?.chunks.length ?? 0) >= 1);
});
