import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadiness, READINESS_WEIGHTS, READINESS_WEIGHTS_BY_STAGE, readinessStageFor, rankReadinessBlockers } from "../dist/index.js";

const base = { totalSections: 10, approvedSections: 0, totalIndicators: 6, verifiedIndicators: 6, requiredEvidenceCount: 5, attachedEvidenceCount: 5, totalChecklistItems: 4, resolvedOrAcceptedItems: 4, approvalProgress: 0 };

test("default stage is SUBMISSION and scores exactly as before (golden)", () => {
  const r = calculateReadiness(base);
  // 0*.25 + 100*.2 + 100*.25 + 100*.2 + 0*.1 = 65
  assert.equal(r.overall, 65);
  assert.equal(r.stage, "SUBMISSION");
  assert.deepEqual(r.weights, READINESS_WEIGHTS);
});

test("every stage's weights sum to 1", () => {
  for (const w of Object.values(READINESS_WEIGHTS_BY_STAGE)) {
    assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
});

test("a correct first draft is not 0%: DRAFTING scores clean sections and ignores approval", () => {
  const r = calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 10 });
  assert.equal(r.overall, 100);
  assert.equal(r.approvalScore, 0);
});

test("DRAFTING still penalises open issues, unverified data and the contradiction cap", () => {
  assert.equal(calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 5 }).overall, 85);
  assert.equal(calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 10, verifiedIndicators: 3 }).overall, 88);
  assert.equal(calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 10, dataQualityBlockers: 2 }).overall, 70);
});

test("no draft yet is 0 sections, never a divide-by-zero", () => {
  const r = calculateReadiness({ ...base, totalSections: 0, stage: "DRAFTING" });
  assert.equal(r.sectionsScore, 0);
});

test("stage derives from draft status", () => {
  assert.equal(readinessStageFor(undefined), "DRAFTING");
  assert.equal(readinessStageFor("DRAFT"), "DRAFTING");
  assert.equal(readinessStageFor("UNDER_REVIEW"), "IN_REVIEW");
  for (const s of ["APPROVED", "EXPORTED", "SUBMITTED"]) assert.equal(readinessStageFor(s), "SUBMISSION");
});

const ctx = { totalSections: 10, sectionsNeedingAttention: 4, unverifiedIndicators: 2, unconfirmedCalculations: 1, openChecklistItems: 3, evidenceShortfall: 2, openContradictions: 0 };

test("blockers are the top three by points, deterministic, with an action each", () => {
  const b = calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 6, verifiedIndicators: 4, attachedEvidenceCount: 3, resolvedOrAcceptedItems: 1 });
  const top = rankReadinessBlockers(b, ctx);
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((t) => t.points), [...top.map((t) => t.points)].sort((a, c) => c - a));
  assert.ok(top.every((t) => t.action.label && t.detail));
  assert.deepEqual(top, rankReadinessBlockers(b, ctx));
});

test("a fully clear report has no blockers; approval is never advised while drafting", () => {
  const clear = calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 10 });
  assert.deepEqual(rankReadinessBlockers(clear, ctx), []);
  const partial = calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 5 });
  assert.ok(!rankReadinessBlockers(partial, ctx, 10).some((t) => t.key === "approval"));
});

test("contradiction blocker shows what clearing the cap would add", () => {
  const capped = calculateReadiness({ ...base, stage: "DRAFTING", cleanSections: 10, dataQualityBlockers: 2 });
  const top = rankReadinessBlockers(capped, { ...ctx, openContradictions: 2, uncappedOverall: 100 });
  assert.equal(top[0].key, "contradictions");
  assert.equal(top[0].points, 30);
});
