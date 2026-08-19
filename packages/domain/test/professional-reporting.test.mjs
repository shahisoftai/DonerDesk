import assert from "node:assert/strict";
import test from "node:test";
import {
  ReportRevision,
  ReportClaim,
  SubmissionSnapshot,
  createRequirementPack,
  createAwardOverride,
  resolveRequirements,
  gateKindForReason,
  stableFingerprint,
  defaultMaterialityFor,
  computeCoverageMetrics,
  extractNumericAtoms,
  classifyNumericAtomRoles,
  canTransitionAssurance,
  initialAssuranceState,
  canApproveAssurance,
} from "../dist/index.js";

test("ReportRevision starts UNASSESSED and transitions through assurance states", () => {
  const revision = ReportRevision.create({
    id: "rev-1",
    tenantId: "tenant-a",
    draftId: "draft-1",
    sectionId: "sec-1",
    revisionNumber: 1,
    content: "Forty-five participants attended",
    contentHash: "a".repeat(64),
    changeOrigin: "GENERATION",
    actorId: "user-1",
  });
  assert.equal(revision.assuranceState, "UNASSESSED");
  assert.equal(revision.requiresReview, true);
  assert.equal(canApproveAssurance(revision.assuranceState), false);

  revision.markAssessing();
  assert.equal(revision.assuranceState, "ASSESSING");
  revision.markCurrent();
  assert.equal(revision.assuranceState, "CURRENT");
  assert.equal(canApproveAssurance(revision.assuranceState), true);

  revision.markStale();
  assert.equal(canApproveAssurance(revision.assuranceState), false);
  revision.markFailed();
  assert.equal(revision.assuranceState, "FAILED");
});

test("invalid assurance transitions are rejected", () => {
  const revision = ReportRevision.create({
    id: "rev-x",
    tenantId: "tenant-a",
    draftId: "draft-1",
    sectionId: "sec-1",
    revisionNumber: 1,
    content: "x",
    contentHash: "a".repeat(64),
    changeOrigin: "GENERATION",
    actorId: "u",
  });
  assert.throws(() => revision.markCurrent(), /cannot transition/);
  assert.throws(() => revision.markStale(), /cannot transition/);
});

test("ReportRevision rejects invalid hashes and revision numbers", () => {
  assert.throws(() =>
    ReportRevision.create({
      id: "rev-2",
      tenantId: "tenant-a",
      draftId: "draft-1",
      sectionId: "sec-1",
      revisionNumber: 0,
      content: "x",
      contentHash: "a".repeat(64),
      changeOrigin: "MANUAL_EDIT",
      actorId: "u",
    }),
    /revisionNumber/,
  );
  assert.throws(() =>
    ReportRevision.create({
      id: "rev-3",
      tenantId: "tenant-a",
      draftId: "draft-1",
      sectionId: "sec-1",
      revisionNumber: 1,
      content: "x",
      contentHash: "not-a-hash",
      changeOrigin: "MANUAL_EDIT",
      actorId: "u",
    }),
    /contentHash/,
  );
});

test("assurance state transitions are enforced", () => {
  assert.equal(canTransitionAssurance("UNASSESSED", "ASSESSING"), true);
  assert.equal(canTransitionAssurance("UNASSESSED", "CURRENT"), false);
  assert.equal(canTransitionAssurance("CURRENT", "STALE"), true);
  assert.equal(initialAssuranceState(), "UNASSESSED");
});

test("ReportClaim binds to revisions and carries reason codes", () => {
  const claim = ReportClaim.assert({
    id: "claim-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportDraftId: "draft-1",
    sectionId: "sec-1",
    text: "30 people were reached in this period",
    type: "NUMERIC",
    numericAtoms: extractNumericAtoms("30 people were reached in this period"),
    charStart: 0,
    charEnd: 37,
  });
  claim.bindToRevision("rev-1", "b".repeat(64));
  claim.setVerification("FAILED", "Numeric assertion failed", "VALUE_MISMATCH");
  assert.equal(claim.revisionId, "rev-1");
  assert.equal(claim.verificationReasonCode, "VALUE_MISMATCH");
  assert.equal(claim.materiality, "MATERIAL");
  assert.equal(claim.numericAtoms.length, 1);
});

test("numeric atoms extract with roles", () => {
  const atoms = classifyNumericAtomRoles("Reached 500 beneficiaries, against a target of 800 and baseline 200", extractNumericAtoms("Reached 500 beneficiaries, against a target of 800 and baseline 200"));
  assert.equal(atoms.length, 3);
  assert.equal(atoms[0].value, "500");
  assert.equal(atoms[1].value, "800");
  assert.equal(atoms[2].value, "200");
});

test("materiality is derived deterministically", () => {
  assert.equal(defaultMaterialityFor("NUMERIC", true), "MATERIAL");
  assert.equal(defaultMaterialityFor("CAUSAL", false), "MATERIAL");
  assert.equal(defaultMaterialityFor("COMPLIANCE_DECLARATION", false), "MATERIAL");
  assert.equal(defaultMaterialityFor("QUALITATIVE", false), "NOT_MATERIAL");
  assert.equal(defaultMaterialityFor("QUALITATIVE", true), "MATERIAL");
  // Factual, recommendation, and forecast statements are material only when
  // they carry a numeric atom; extractors classify material subcategories
  // (safeguarding, incident, budget, donor-commitment) as compliance
  // declarations so they remain material.
  assert.equal(defaultMaterialityFor("FACTUAL", false), "NOT_MATERIAL");
  assert.equal(defaultMaterialityFor("FACTUAL", true), "MATERIAL");
  assert.equal(defaultMaterialityFor("RECOMMENDATION", false), "NOT_MATERIAL");
  assert.equal(defaultMaterialityFor("FORECAST", false), "NOT_MATERIAL");
});

test("coverage metrics block incomplete revisions", () => {
  const coverage = computeCoverageMetrics(
    [
      { materiality: "MATERIAL", verificationResult: "FAILED", type: "NUMERIC", text: "30 reached", verificationReasonCode: "VALUE_MISMATCH" },
      { materiality: "MATERIAL", verificationResult: "PASSED", type: "NUMERIC", text: "40 reached", verificationReasonCode: undefined },
    ],
    { requireCurrentVerification: true },
  );
  assert.equal(coverage.complete, false);
  assert.equal(coverage.materialAssertions, 2);
  assert.equal(coverage.blockingReasons.length, 1);
});

test("requirement precedence: award overrides donor packs, packs fill gaps", () => {
  const baseline = [
    {
      id: "b1",
      key: "SECTION:executive-summary",
      kind: "SECTION",
      required: true,
      severity: "BLOCKING",
      sourceReference: { sourceType: "BASELINE", sourceId: "baseline", version: 1, label: "baseline" },
    },
    {
      id: "b2",
      key: "SECTION:risks",
      kind: "SECTION",
      required: false,
      severity: "INFO",
      sourceReference: { sourceType: "BASELINE", sourceId: "baseline", version: 1, label: "baseline" },
    },
  ];
  const donorPack = [
    {
      id: "d1",
      key: "SECTION:executive-summary",
      kind: "SECTION",
      required: true,
      severity: "BLOCKING",
      sourceReference: { sourceType: "DONOR_PACK", sourceId: "pack", version: 2, label: "pack" },
    },
    {
      id: "d2",
      key: "ANNEX:financial-statement",
      kind: "ANNEX",
      required: true,
      severity: "BLOCKING",
      sourceReference: { sourceType: "DONOR_PACK", sourceId: "pack", version: 2, label: "pack" },
    },
  ];
  const award = [
    {
      id: "a1",
      key: "SECTION:executive-summary",
      kind: "SECTION",
      required: true,
      severity: "WARNING",
      sourceReference: { sourceType: "AWARD_AMENDMENT", sourceId: "award", version: 3, label: "award" },
    },
  ];
  const merged = resolveRequirements({
    layers: [
      { sourceType: "BASELINE", requirements: baseline },
      { sourceType: "DONOR_PACK", requirements: donorPack },
      { sourceType: "AWARD_AMENDMENT", requirements: award },
    ],
  });
  assert.equal(merged.requirements.length, 3);
  const execSummary = merged.requirements.find((r) => r.key === "SECTION:executive-summary");
  assert.equal(execSummary?.sourceReference.sourceType, "AWARD_AMENDMENT");
  const annex = merged.requirements.find((r) => r.key === "ANNEX:financial-statement");
  assert.equal(annex?.sourceReference.sourceType, "DONOR_PACK");
  const risks = merged.requirements.find((r) => r.key === "SECTION:risks");
  assert.equal(risks?.sourceReference.sourceType, "BASELINE");
});

test("requirement packs require a specific donor key", () => {
  assert.throws(() => createRequirementPack({ id: "p1", donorKey: "UN", mechanismKey: "grant", reportType: "ANNUAL", name: "bad", requirements: [] }), /donorKey/);
  assert.throws(() => createRequirementPack({ id: "p2", donorKey: "un-ocha-standard-grant", mechanismKey: "grant", reportType: "ANNUAL", name: "empty", requirements: [] }), /at least one/);
});

test("award overrides require requirements", () => {
  assert.throws(() =>
    createAwardOverride({
      id: "o1",
      tenantId: "t",
      projectId: "p",
      awardId: "a",
      effectiveFrom: "2026-01-01",
      requirements: [],
      sourceReference: { sourceType: "AWARD", sourceId: "a", version: 1, label: "award" },
    }),
    /at least one/,
  );
});

test("submission snapshot requires approved revisions with hashes", () => {
  const snapshot = SubmissionSnapshot.create({
    id: "snap-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportDraftId: "draft-1",
    reportingPeriodId: "period-1",
    approvedRevisionIds: ["rev-1"],
    revisionHashes: { "rev-1": "c".repeat(64) },
    requirementSnapshotId: "req-1",
  });
  assert.equal(snapshot.status, "SEALED");
  assert.equal(snapshot.approvedRevisionIds.length, 1);
  snapshot.addArtifactHash({ artifactType: "DOCX", hash: "d".repeat(64) });
  assert.equal(snapshot.artifactHashes.length, 1);
  snapshot.void();
  assert.equal(snapshot.status, "VOID");
  assert.throws(() => snapshot.addArtifactHash({ artifactType: "PDF", hash: "e".repeat(64) }), /voided/);
  assert.throws(() =>
    SubmissionSnapshot.create({
      id: "snap-2",
      tenantId: "t",
      projectId: "p",
      reportDraftId: "d",
      reportingPeriodId: "r",
      approvedRevisionIds: ["rev-x"],
      revisionHashes: {},
      requirementSnapshotId: "req",
    }),
    /missing hash/,
  );
});

test("gate kinds map from structured reason codes", () => {
  assert.equal(gateKindForReason("VALUE_MISMATCH"), "NUMERIC_CONTRADICTION");
  assert.equal(gateKindForReason("EVIDENCE_HASH_MISMATCH"), "EVIDENCE_HASH_MISMATCH");
  assert.equal(gateKindForReason("CAUSAL_REVIEW_REQUIRED"), "CAUSAL_REVIEW_REQUIRED");
  assert.equal(gateKindForReason("REQUIREMENT_UNSATISFIED"), "REQUIREMENT_UNSATISFIED");
  assert.equal(gateKindForReason("COVERAGE_GAP"), "ASSERTION_COVERAGE_GAP");
  assert.equal(gateKindForReason("SOURCE_MISSING"), "UNSUPPORTED_MATERIAL_CLAIM");
  assert.equal(gateKindForReason("CONFIDENTIALITY_RESTRICTED"), "CONFIDENTIALITY_VIOLATION");
});

test("stable fingerprints are deterministic and content-sensitive", () => {
  assert.equal(stableFingerprint("The training was delivered."), stableFingerprint("The  training  was delivered."));
  assert.notEqual(stableFingerprint("The training was delivered."), stableFingerprint("The training was cancelled."));
});
