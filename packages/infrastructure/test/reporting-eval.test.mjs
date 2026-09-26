import assert from "node:assert/strict";
import test from "node:test";
import { ReportDraftEvaluator } from "../dist/ai/reporting-eval.js";

/**
 * Pins the WS3 donor-visibility metric: a declared attribution sentence must
 * survive the draft, and its absence is a critical failure that is never
 * averaged away. Cases without the field keep their exact legacy metric
 * surface (no donor-visibility score emitted).
 */

const USAID_SENTENCE =
  "This document is made possible by the generous support of the American people through the United States Agency for International Development (USAID)";

const compliantCase = {
  name: "attribution-present",
  draftText: `${USAID_SENTENCE}. The project reached 1,200 individuals this quarter.`,
  referenceAssertions: [{ text: USAID_SENTENCE }],
  numericFacts: [{ value: "1,200", expected: "present" }],
  requiredLimitations: [],
  requiredAttribution: USAID_SENTENCE,
};

test("donor-visibility passes when the declared attribution sentence survives", () => {
  const evaluator = new ReportDraftEvaluator();
  const result = evaluator.evaluateCase(compliantCase);
  const visibility = result.scores.find((s) => s.metric === "donor-visibility");
  assert.ok(visibility, "donor-visibility metric reported when declared");
  assert.equal(visibility.score, 1);
  assert.equal(visibility.details, "present");
  assert.equal(result.passed, true);
});

test("donor-visibility is a critical failure when the attribution is missing", () => {
  const evaluator = new ReportDraftEvaluator();
  const result = evaluator.evaluateCase({
    ...compliantCase,
    name: "attribution-missing",
    draftText: "The project reached 1,200 individuals this quarter. Coverage data is preliminary.",
  });
  const visibility = result.scores.find((s) => s.metric === "donor-visibility");
  assert.ok(visibility);
  assert.equal(visibility.score, 0);
  assert.equal(visibility.details, "missing");
  // Even with a strong aggregate (only 1 of 4 metrics missed), the case must
  // fail: attribution obligations are never averaged away.
  assert.equal(result.passed, false);
});

test("punctuation-only differences do not mask a present attribution", () => {
  const evaluator = new ReportDraftEvaluator();
  const result = evaluator.evaluateCase({
    ...compliantCase,
    name: "attribution-punctuation",
    draftText: `The project reached 1,200 individuals this quarter. ${USAID_SENTENCE}!`,
  });
  const visibility = result.scores.find((s) => s.metric === "donor-visibility");
  assert.equal(visibility.score, 1);
  assert.equal(result.passed, true);
});

test("cases without requiredAttribution keep the legacy metric surface", () => {
  const evaluator = new ReportDraftEvaluator();
  const result = evaluator.evaluateCase({
    name: "legacy-case",
    draftText: "The project reached 1,200 individuals this quarter.",
    referenceAssertions: [],
    numericFacts: [{ value: "1,200", expected: "present" }],
    requiredLimitations: [],
  });
  assert.equal(result.scores.some((s) => s.metric === "donor-visibility"), false);
  assert.equal(result.passed, true);
});
