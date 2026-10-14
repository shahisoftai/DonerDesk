import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReportingSteps, countStoryAnswers } from "../../src/features/reporting/application/reporting-steps.ts";

const base = { indicatorCount: 5, unverifiedIndicatorCount: 0, storyAnswered: 0, hasDraft: false, draftStatus: null };

test("fresh period: update is current when indicators are unverified", () => {
  assert.deepEqual(computeReportingSteps({ ...base, unverifiedIndicatorCount: 2 }), {
    update: "current",
    story: "next",
    generate: "next",
    review: "next",
  });
});

test("no indicators at all is not 'done'", () => {
  assert.equal(computeReportingSteps({ ...base, indicatorCount: 0 }).update, "current");
});

test("verified indicators, no story: story is current", () => {
  assert.deepEqual(computeReportingSteps(base), { update: "done", story: "current", generate: "next", review: "next" });
});

test("story answered, no draft: generate is current", () => {
  assert.equal(computeReportingSteps({ ...base, storyAnswered: 3 }).generate, "current");
});

test("draft exists in DRAFT: review is current", () => {
  const steps = computeReportingSteps({ ...base, storyAnswered: 1, hasDraft: true, draftStatus: "DRAFT" });
  assert.deepEqual(steps, { update: "done", story: "done", generate: "done", review: "current" });
});

test("submitted draft marks review done", () => {
  const steps = computeReportingSteps({ ...base, storyAnswered: 1, hasDraft: true, draftStatus: "UNDER_REVIEW" });
  assert.equal(steps.review, "done");
});

test("skipped earlier step stays current even after a draft exists", () => {
  const steps = computeReportingSteps({ ...base, storyAnswered: 0, hasDraft: true, draftStatus: "DRAFT" });
  assert.equal(steps.story, "current");
  assert.equal(steps.generate, "done");
  assert.equal(steps.review, "next");
});

test("story answers ignore blank values", () => {
  assert.equal(countStoryAnswers(undefined), 0);
  assert.equal(countStoryAnswers({ achievements: "Delivered", challenges: "   ", lessons: "Engage early" }), 2);
});

import { nextReportSteps } from "../../src/features/reporting/application/reporting-steps.ts";

const none = { unverifiedIndicatorCount: 0, hasDraft: false, draftStatus: null, pendingFailedClaims: 0, sectionCount: 0, approvedSectionCount: 0 };

test("next steps: values first, then the draft", () => {
  assert.deepEqual(nextReportSteps({ ...none, unverifiedIndicatorCount: 3 }).map((s) => s.kind), ["enter-indicators", "generate"]);
  assert.equal(nextReportSteps({ ...none, unverifiedIndicatorCount: 1 })[0]!.label, "Enter and verify 1 indicator row");
  assert.deepEqual(nextReportSteps(none).map((s) => s.kind), ["generate"]);
});

test("next steps with a draft: decisions, then sections, then submit, then approve", () => {
  const draft = { ...none, hasDraft: true, draftStatus: "DRAFT", sectionCount: 4 };
  assert.deepEqual(nextReportSteps({ ...draft, pendingFailedClaims: 2, approvedSectionCount: 1 }).map((s) => s.kind), ["review-statements", "approve-sections"]);
  assert.equal(nextReportSteps({ ...draft, approvedSectionCount: 1 })[0]!.label, "Approve the remaining 3 sections");
  assert.deepEqual(nextReportSteps({ ...draft, approvedSectionCount: 4 }).map((s) => s.kind), ["submit-review"]);
  assert.deepEqual(nextReportSteps({ ...draft, draftStatus: "UNDER_REVIEW", approvedSectionCount: 4 }).map((s) => s.kind), ["approve-report"]);
  assert.deepEqual(nextReportSteps({ ...draft, draftStatus: "APPROVED", approvedSectionCount: 4 }), []);
});
