import test from "node:test";
import assert from "node:assert/strict";
import { summarizePlanDelivery, planDeliverySentences, suggestStoryFromPlan, rankReadinessBlockers, calculateReadiness } from "../dist/index.js";

const P = { start: "2026-07-01", end: "2026-09-30" };
const item = (o) => ({ status: "PLANNED", plannedStart: "2026-07-10", plannedEnd: "2026-07-12", moved: false, ...o });

test("no plan for the period is undefined, so a project without a plan reports as before", () => {
  assert.equal(summarizePlanDelivery([], P), undefined);
  assert.equal(summarizePlanDelivery([item({ plannedEnd: "2026-12-01" })], P), undefined);
});
test("counts planned, held, not held, moved and cancelled, with reasons", () => {
  const s = summarizePlanDelivery([item({ status: "DONE" }), item({ status: "DONE" }), item({}), item({ moved: true, reason: "Road closed by flood" }), item({ status: "CANCELLED", reason: "Donor request" })], P);
  assert.deepEqual([s.planned, s.held, s.notHeld, s.moved, s.cancelled], [4, 2, 2, 1, 1]);
  assert.deepEqual(s.movedReasons, ["Road closed by flood"]);
  assert.deepEqual(s.cancelledReasons, ["Donor request"]);
});
test("sentences state the counts and carry no dates", () => {
  const s = summarizePlanDelivery([item({ status: "DONE" }), item({})], P);
  const text = planDeliverySentences(s).join(" ");
  assert.match(text, /2 activities were planned for this period and 1 were held/);
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/);
});
test("story suggestions fill only what the plan states", () => {
  assert.deepEqual(suggestStoryFromPlan(undefined), {});
  const s = suggestStoryFromPlan(summarizePlanDelivery([item({}), item({ moved: true, reason: "Flood" })], P));
  assert.match(s.challenges, /2 of the 2/);
  assert.match(s.varianceExplanations, /Moved: Flood/);
});
test("readiness advice: one point, only when supplied, never changes a score", () => {
  const b = calculateReadiness({ totalSections: 1, approvedSections: 0, cleanSections: 1, stage: "DRAFTING", totalIndicators: 1, verifiedIndicators: 1, requiredEvidenceCount: 1, attachedEvidenceCount: 1, totalChecklistItems: 1, resolvedOrAcceptedItems: 1, approvalProgress: 0 });
  const ctx = { totalSections: 1, sectionsNeedingAttention: 0, unverifiedIndicators: 0, unconfirmedCalculations: 0, openChecklistItems: 0, evidenceShortfall: 0, openContradictions: 0 };
  assert.equal(rankReadinessBlockers(b, ctx, 10).some((x) => x.key === "plan"), false);
  const plan = rankReadinessBlockers(b, { ...ctx, plannedNotHeld: 3 }, 10).find((x) => x.key === "plan");
  assert.match(plan.detail, /3 planned activities in this period have no completed activity yet/);
});
