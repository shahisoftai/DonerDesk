import { test } from "node:test";
import assert from "node:assert/strict";
import { readinessHeadline, blockerActionHref } from "../../src/features/projects/application/readiness-view.ts";

test("no draft yet invites generating one instead of showing 0%", () => {
  assert.equal(readinessHeadline(0, "DRAFTING", false), "Generate a draft to start");
});
test("headline names the stage", () => {
  assert.equal(readinessHeadline(82, "DRAFTING", true), "Drafting · 82%");
  assert.equal(readinessHeadline(60, "IN_REVIEW", true), "In review · 60%");
  assert.equal(readinessHeadline(100, "SUBMISSION", true), "Ready to submit · 100%");
});
test("legacy payload without a stage reads as submission", () => {
  assert.equal(readinessHeadline(40, undefined, true), "Ready to submit · 40%");
});
test("every action kind resolves, unknown falls back to the report", () => {
  assert.equal(blockerActionHref("OPEN_INPUTS", "p", "r"), "/projects/p/reports/r/inputs");
  assert.equal(blockerActionHref("OPEN_EVIDENCE", "p", "r"), "/projects/p/evidence");
  assert.equal(blockerActionHref("OPEN_CHECKLIST", "p", "r"), "/projects/p/compliance");
  assert.equal(blockerActionHref("SOMETHING_NEW", "p", "r"), "/projects/p/reports/r");
});
