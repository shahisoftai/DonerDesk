import assert from "node:assert/strict";
import test from "node:test";
import { ApproveReportSectionHandler } from "../dist/index.js";

/**
 * P0-3 — NOT_MATERIAL failed claims must not block approval. Only unresolved
 * MATERIAL failed claims block. Resolved claims (material or not) are not
 * blockers at the claim gate (they are the P0-1 reconciliation concern).
 */

function makeHandler(claims) {
  const section = {
    currentRevisionId: "rev-1",
    approved: false,
    approve() {
      this.approved = true;
    },
  };
  const sectionsRepo = {
    findById: async () => ({ ok: true, value: section }),
    update: async (s) => ({ ok: true, value: s }),
  };
  const revisionsRepo = {
    findById: async () => ({ ok: true, value: { id: "rev-1", assuranceState: "CURRENT" } }),
  };
  const claimsRepo = {
    findBySection: async () => ({ ok: true, value: claims }),
  };
  const audit = { record: async () => ({ ok: true }) };
  const handler = new ApproveReportSectionHandler(sectionsRepo, claimsRepo, revisionsRepo, audit);
  return { handler, section };
}

const ctx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1" }, requestId: "r" };

test("P0-3: a NOT_MATERIAL FAILED unresolved claim does not block approval", async () => {
  const { handler, section } = makeHandler([
    { id: "c1", verificationResult: "FAILED", resolvedById: undefined, materiality: "NOT_MATERIAL" },
  ]);
  const result = await handler.handle(ctx, "section-1");
  assert.ok(result.ok, "NOT_MATERIAL failed claim must not block approval");
  assert.ok(section.approved);
});

test("P0-3: an unresolved MATERIAL FAILED claim blocks approval with an actionable message", async () => {
  const { handler, section } = makeHandler([
    { id: "c1", verificationResult: "FAILED", resolvedById: undefined, materiality: "MATERIAL" },
  ]);
  const result = await handler.handle(ctx, "section-1");
  assert.ok(!result.ok);
  assert.equal(result.error.code, "REPORT_GATE_BLOCKED");
  assert.match(result.error.message, /still needs? a decision/i);
  assert.ok(!section.approved);
});

test("P0-3: a resolved MATERIAL FAILED claim does not block the claim gate (CURRENT revision)", async () => {
  const { handler, section } = makeHandler([
    { id: "c1", verificationResult: "FAILED", resolvedById: "user-1", materiality: "MATERIAL" },
  ]);
  const result = await handler.handle(ctx, "section-1");
  assert.ok(result.ok, "resolved claim must not block the claim gate");
  assert.ok(section.approved);
});
