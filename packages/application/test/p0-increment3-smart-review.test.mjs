import assert from "node:assert/strict";
import test from "node:test";
import { GetSmartReviewHandler } from "../dist/index.js";

/**
 * Increment 3 — Smart Review is a read over the authoritative gate, not a
 * second compliance system. It reuses ApproveReportHandler.evaluateGate and
 * only groups/translates its blockingIssues.
 */

function makeHandler(gateBlockingIssues, claims = [], sections = []) {
  const draftsRepo = {
    findByReportingPeriod: async () => ({ ok: true, value: [{ id: "draft-1", isSuperseded: false, projectId: "p1", reportingPeriodId: "period-1" }] }),
  };
  const approveGate = {
    evaluateGate: async () => ({ ok: true, value: { approvalBlocked: false, submitBlocked: false, submitNeedsDecision: false, blockReasons: [], blockingIssues: gateBlockingIssues } }),
  };
  const claimsRepo = { findByDraft: async () => ({ ok: true, value: claims }) };
  const sectionsRepo = { findByReportDraft: async () => ({ ok: true, value: sections }) };
  return new GetSmartReviewHandler(draftsRepo, approveGate, claimsRepo, sectionsRepo);
}

const ctx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role: "ADMIN" }, requestId: "r" };

test("Smart Review handler: reuses the gate and translates cleanly (no raw detail)", async () => {
  const handler = makeHandler(
    [{ kind: "NUMERIC_CONTRADICTION", detail: "VALUE_MISMATCH. 80 matches no verified indicator value this period", claimId: "c1", sectionId: "s1" }],
    [{ id: "c1", text: "OUT-3 is shown as 8,450 beneficiaries.", sectionId: "s1" }],
    [{ id: "s1", sectionTitle: "Progress" }],
  );
  const result = await handler.handle(ctx, "period-1");
  assert.ok(result.ok);
  assert.equal(result.value.issueCount, 1);
  const item = result.value.items[0];
  assert.equal(item.title, "A reported figure doesn't match your approved data");
  assert.ok(!/VALUE_MISMATCH|ASSERTION|reason code/i.test(item.explanation));
  assert.ok(item.explanation.includes("8,450"));
  assert.equal(item.claimId, "c1");
  assert.equal(item.sectionId, "s1");
});

test("Smart Review handler: a fully-resolved report yields the empty ready state", async () => {
  const handler = makeHandler([]);
  const result = await handler.handle(ctx, "period-1");
  assert.ok(result.ok);
  assert.equal(result.value.issueCount, 0);
  assert.equal(result.value.blockingCount, 0);
  assert.deepEqual(result.value.items, []);
});
