import assert from "node:assert/strict";
import test from "node:test";
import { ReportAssuranceService, ResolveReportClaimHandler, ApproveReportSectionHandler } from "@donordesk/application";
import { DeterministicAssertionExtractor } from "../dist/llm/assertion-extractor.js";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";
import { ReportDraft, ReportSection, ReportRevision, ReportClaim, TenantId } from "@donordesk/domain";

/**
 * P0-1 — Resolution → Assurance reconciliation.
 *
 * Generate → failed material claim → accept with note → revision reconciles →
 * approve succeeds. Resolving every blocking claim must let the section reach
 * an approvable state, and a reassessment must not destroy the resolution.
 */

const TENANT = TenantId.create("tenant-a");

// Content whose only numeric claim (999) matches no verified finding, so the
// assertion deterministically fails as a MATERIAL VALUE_MISMATCH.
const CONTENT = "OUT-1 (Centres established): 999 centres.";

function buildHarness() {
  let idCounter = 0;
  const ids = { generate: () => `id-${++idCounter}` };

  const draft = ReportDraft.create({
    id: "draft-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportingPeriodId: "period-1",
    title: "Test report",
    generatedByAi: true,
    createdById: "user-1",
  });

  const section = ReportSection.create({
    id: "section-1",
    tenantId: "tenant-a",
    reportDraftId: draft.id,
    sectionTitle: "Narrative Report",
    sectionOrder: 0,
    content: CONTENT,
    sourceReferences: [],
    unsupportedClaims: [],
    status: "NEEDS_REVIEW",
  });

  const revision = ReportRevision.create({
    id: "rev-1",
    tenantId: "tenant-a",
    draftId: draft.id,
    sectionId: section.id,
    revisionNumber: 1,
    content: CONTENT,
    contentHash: "a".repeat(64),
    changeOrigin: "GENERATION",
    actorId: "user-1",
  });
  // Simulate the post-verification state: the section has content with a
  // failing material claim, and the revision was marked FAILED.
  revision.markAssessing();
  revision.markFailed();
  section.setCurrentRevision(revision.id);

  const seededClaim = ReportClaim.create({
    id: "claim-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportDraftId: draft.id,
    sectionId: section.id,
    text: CONTENT,
    type: "NUMERIC",
    verificationResult: "FAILED",
    verificationDetail: "VALUE_MISMATCH. 999 matches no verified indicator value this period",
    numericAtoms: [{ charStart: 27, charEnd: 30, value: "999", role: "ACHIEVEMENT" }],
    revisionId: revision.id,
    revisionHash: revision.contentHash,
  });

  const claims = [seededClaim];
  let latestRevision = revision;

  const claimsRepo = {
    findById: async () => ({ ok: true, value: claims.find((c) => c.id === "claim-1") }),
    findBySection: async () => ({ ok: true, value: [...claims] }),
    findByDraft: async () => ({ ok: true, value: [...claims] }),
    findBySectionDraft: async () => ({ ok: true, value: [...claims] }),
    create: async (c) => { claims.push(c); return { ok: true, value: c }; },
    update: async (c) => { const i = claims.findIndex((x) => x.id === c.id); if (i >= 0) claims[i] = c; else claims.push(c); return { ok: true, value: c }; },
    deleteBySection: async () => { claims.length = 0; return { ok: true }; },
  };
  const sectionsRepo = {
    findById: async () => ({ ok: true, value: section }),
    update: async (s) => ({ ok: true, value: s }),
  };
  const draftsRepo = {
    findById: async () => ({ ok: true, value: draft }),
  };
  const revisionsRepo = {
    findById: async () => ({ ok: true, value: latestRevision }),
    update: async (r) => { latestRevision = r; return { ok: true, value: r }; },
  };
  const analytics = { computeFindings: async () => ({ ok: true, value: [] }) };
  const evidencePackages = { build: async () => ({ ok: true, value: [] }) };

  const extractor = new DeterministicAssertionExtractor();
  const verifier = new DeterministicClaimVerifier();
  const assurance = new ReportAssuranceService(
    ids, sectionsRepo, draftsRepo, revisionsRepo, claimsRepo,
    extractor, verifier, analytics, evidencePackages, undefined,
  );

  return { assurance, claimsRepo, sectionsRepo, revisionsRepo, section, latestRevision: () => latestRevision };
}

const ctx = { tenant: { tenantId: TENANT, userId: "user-1", role: "ADMIN" }, requestId: "r" };

test("P0-1: Generate → failed material claim → accept with note → reconcile → approve → caveat/audit preserved (full workflow)", async () => {
  const { assurance, claimsRepo, sectionsRepo, revisionsRepo } = buildHarness();
  const auditEvents = [];
  const audit = { record: async (e) => { auditEvents.push(e); return { ok: true }; } };
  const resolver = new ResolveReportClaimHandler(claimsRepo, audit, sectionsRepo, assurance);

  // Section starts blocked (revision FAILED).
  const approve = new ApproveReportSectionHandler(sectionsRepo, claimsRepo, revisionsRepo, audit);
  const before = await approve.handle(ctx, "section-1");
  assert.ok(!before.ok, "section must be blocked before resolution");

  // Accept the failed material claim with a documented limitation.
  const resolved = await resolver.handle(ctx, "claim-1", { resolution: "ACCEPTED_WITH_LIMITATION", notes: "Accepted pending final field verification" });
  assert.ok(resolved.ok);

  // The reconciliation must have promoted the revision to CURRENT.
  const revAfter = await revisionsRepo.findById("rev-1", TENANT);
  assert.equal(revAfter.value.assuranceState, "CURRENT", "revision must reconcile to CURRENT after resolution");

  // Approval now succeeds.
  const after = await approve.handle(ctx, "section-1");
  assert.ok(after.ok, "approval must succeed once the blocking claim is resolved");

  // Audit history is intact: a resolution audit event was recorded.
  assert.ok(
    auditEvents.some((e) => e.eventType === "report.claim.accepted_with_limitation"),
    "resolution audit event must be recorded",
  );

  // The accepted-with-limitation decision is preserved on the reassessed claim
  // (this is the record the export/submission snapshot reads, so the caveat
  // survives into the exported donor report).
  const claims = await claimsRepo.findBySection("section-1", TENANT);
  const materialClaim = claims.value.find((c) => c.materiality === "MATERIAL" && c.verificationResult === "FAILED");
  assert.ok(materialClaim, "reassessed claim exists");
  assert.equal(materialClaim.resolvedById, "user-1", "resolution must be carried forward across reassessment");
  assert.ok(materialClaim.resolutionNotes, "limitation note must be preserved (visible caveat)");
  assert.ok(materialClaim.resolvedAt, "resolution timestamp must be preserved for the export trail");
});

test("P0-1: an EXCLUDED material claim is carried forward and does not block approval", async () => {
  const { assurance, claimsRepo, sectionsRepo, revisionsRepo } = buildHarness();
  const audit = { record: async () => ({ ok: true }) };
  const resolver = new ResolveReportClaimHandler(claimsRepo, audit, sectionsRepo, assurance);
  const approve = new ApproveReportSectionHandler(sectionsRepo, claimsRepo, revisionsRepo, audit);

  const resolved = await resolver.handle(ctx, "claim-1", { resolution: "EXCLUDED" });
  assert.ok(resolved.ok);
  const revAfter = await revisionsRepo.findById("rev-1", TENANT);
  assert.equal(revAfter.value.assuranceState, "CURRENT", "revision must reconcile after exclusion");
  const after = await approve.handle(ctx, "section-1");
  assert.ok(after.ok, "approval must succeed after exclusion");

  const claims = await claimsRepo.findBySection("section-1", TENANT);
  const materialClaim = claims.value.find((c) => c.materiality === "MATERIAL");
  assert.equal(materialClaim.resolvedById, "user-1", "excluded decision must not silently return");
});
