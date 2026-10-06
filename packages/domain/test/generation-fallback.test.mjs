import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATION_FALLBACK_REASONS,
  FALLBACK_ACTION,
  ReportSection,
  ungroundedFiguresFromIssues,
  fallbackDetailFromIssues,
  recoveryInstruction,
  isTransientFallback,
  RECORDED_FIGURES_ONLY_INSTRUCTION,
} from "../dist/index.js";

const issue = "UNGROUNDED_NUMBER: 33.3, 26.2 do not appear in the verified inputs; quote only recorded figures (percent of target is the only derived figure allowed)";

test("every fallback reason has an action (exhaustive)", () => {
  assert.deepEqual(Object.keys(FALLBACK_ACTION).sort(), [...GENERATION_FALLBACK_REASONS].sort());
});

test("figures are read from the validator issue; detail is user-safe", () => {
  assert.deepEqual(ungroundedFiguresFromIssues([issue, "STYLE: x"]), ["33.3", "26.2"]);
  assert.equal(fallbackDetailFromIssues([issue]), "figures not in your data: 33.3, 26.2");
  assert.equal(fallbackDetailFromIssues(["UNGROUNDED_NUMBER: 7 does not appear in x"]), "figure not in your data: 7");
  assert.equal(fallbackDetailFromIssues(["STYLE: passive voice"]), undefined);
  const many = "UNGROUNDED_NUMBER: 1, 2, 3, 4, 5, 6 do not appear in the verified inputs";
  assert.equal(fallbackDetailFromIssues([many]), "figures not in your data: 1, 2, 3, 4 and more");
  assert.doesNotMatch(fallbackDetailFromIssues([issue]), /UNGROUNDED|validator/i);
});

test("the recovery instruction names the figures and keeps an author instruction", () => {
  const text = recoveryInstruction(["33.3", "26.2"], "Mention the clinic");
  assert.match(text, /^Mention the clinic\n\nDo not state 33\.3, 26\.2\. /);
  assert.ok(text.endsWith(RECORDED_FIGURES_ONLY_INSTRUCTION));
  assert.equal(recoveryInstruction([]), RECORDED_FIGURES_ONLY_INSTRUCTION);
});

test("only provider failures are transient", () => {
  assert.deepEqual(GENERATION_FALLBACK_REASONS.filter(isTransientFallback), ["PROVIDER_TIMEOUT", "PROVIDER_EMPTY_RESPONSE", "PROVIDER_HTTP_ERROR"]);
  assert.equal(isTransientFallback(undefined), false);
});

test("a section stores the reason and clears it", () => {
  const section = ReportSection.create({ id: "s", tenantId: "t", reportDraftId: "d", sectionTitle: "Progress", sectionOrder: 1 });
  assert.equal(section.generationFallback, undefined);
  section.recordGenerationFallback({ reason: "VALIDATOR_FAILED", detail: "  figure not in your data: 33.3  " });
  assert.deepEqual(section.generationFallback, { reason: "VALIDATOR_FAILED", detail: "figure not in your data: 33.3" });
  assert.throws(() => section.recordGenerationFallback({ reason: "NOPE" }));
  section.recordGenerationFallback(null);
  assert.equal(section.generationFallback, undefined);
});

test("an internal id in the text is explained and retried with its own instruction", async () => {
  const { hasInternalIdIssue, NO_INTERNAL_IDS_INSTRUCTION } = await import("../dist/index.js");
  const issues = ["INTERNAL_ID: ev-14, report.pdf must not appear in the report; describe the source in words instead"];
  assert.equal(hasInternalIdIssue(issues), true);
  assert.equal(hasInternalIdIssue([issue]), false);
  assert.equal(fallbackDetailFromIssues(issues), "the text named an internal id or file name");
  assert.match(recoveryInstruction([], undefined, { internalIds: true }), new RegExp(`^${NO_INTERNAL_IDS_INSTRUCTION}`));
  assert.doesNotMatch(recoveryInstruction([], undefined), /file name/);
});
