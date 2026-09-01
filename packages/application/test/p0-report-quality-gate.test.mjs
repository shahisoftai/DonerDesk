import assert from "node:assert/strict";
import test from "node:test";
import { ApproveReportHandler } from "../dist/index.js";

/**
 * Report-quality gate regression: NOT_MATERIAL failed claims (metadata /
 * grounded narrative / references) must not surface in Smart Review or block
 * approval — consistent with the P0-3 materiality contract. Only MATERIAL
 * failures produce blocking issues.
 */

function makeHandler(claims) {
  const sections = [
    { id: "section-1", currentRevisionId: "rev-1", sectionTitle: "Executive Summary", content: "content", reportDraftId: "draft-1" },
  ];
  return new ApproveReportHandler(
    // drafts
    { findById: async () => ({ ok: true, value: { id: "draft-1", reportingPeriodId: "period-1", projectId: "proj-1", status: "DRAFT" } }) },
    // periods (unused by evaluateGate)
    { findById: async () => ({ ok: true, value: {} }) },
    // checklist
    { findByReportingPeriod: async () => ({ ok: true, value: [] }) },
    // claims
    { findByDraft: async () => ({ ok: true, value: claims }) },
    // sections
    { findByReportDraft: async () => ({ ok: true, value: sections }) },
    // revisions
    { findById: async () => ({ ok: true, value: { id: "rev-1", assuranceState: "CURRENT" } }) },
    // requirements
    { findLatestForPeriod: async () => ({ ok: true, value: null }) },
    // audit
    { record: async () => ({ ok: true }) },
  );
}

const ctx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role: "ADMIN" }, requestId: "r" };

test("RQ gate: NOT_MATERIAL failed claims do not surface as blocking issues", async () => {
  const handler = makeHandler([
    { id: "c1", sectionId: "section-1", text: "Some grounded narrative content.", type: "QUALITATIVE", materiality: "NOT_MATERIAL", verificationResult: "FAILED", verificationReasonCode: "SOURCE_MISSING", verificationDetail: "Insufficient evidence support for the assertion", resolvedById: undefined, sources: [] },
  ]);
  const r = await handler.evaluateGate(ctx, "period-1", "draft-1");
  assert.ok(r.ok);
  assert.ok(!r.value.blockingIssues.some((i) => i.claimId === "c1"), "NOT_MATERIAL failed claim must not be a blocking issue");
});

test("RQ gate: MATERIAL failed claims DO surface as blocking issues", async () => {
  const handler = makeHandler([
    { id: "c2", sectionId: "section-1", text: "Reached 500 beneficiaries.", type: "NUMERIC", materiality: "MATERIAL", verificationResult: "FAILED", verificationReasonCode: "VALUE_MISMATCH", verificationDetail: "VALUE_MISMATCH. 500 matches no verified indicator value", resolvedById: undefined, sources: [] },
  ]);
  const r = await handler.evaluateGate(ctx, "period-1", "draft-1");
  assert.ok(r.ok);
  assert.ok(r.value.blockingIssues.some((i) => i.claimId === "c2"), "MATERIAL failed claim must remain a blocking issue");
});
