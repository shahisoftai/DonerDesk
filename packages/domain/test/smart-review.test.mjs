import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSmartReview } from "../dist/contexts/reporting/smart-review.js";

/**
 * Increment 3 — Smart Review. A presentation/grouping layer over the existing
 * gate `blockingIssues`. Pure translation + dedupe + ordering. No re-verifying,
 * no second compliance system, no internal terminology in the output.
 */

function issue(overrides = {}) {
  return {
    kind: "UNSUPPORTED_MATERIAL_CLAIM",
    detail: "raw technical detail that must never surface",
    claimId: "claim-1",
    sectionId: "section-1",
    ...overrides,
  };
}

test("Smart Review: multiple gate issues for the same claim become one item", () => {
  const summary = summarizeSmartReview({
    blockingIssues: [
      issue({ claimId: "claim-1", kind: "UNSUPPORTED_MATERIAL_CLAIM" }),
      issue({ claimId: "claim-1", kind: "NUMERIC_CONTRADICTION" }),
      issue({ claimId: "claim-2", kind: "UNSUPPORTED_MATERIAL_CLAIM" }),
    ],
  });
  assert.equal(summary.issueCount, 2, "two claims => two issues (same-claim deduped)");
});

test("Smart Review: no internal reason codes or technical terminology leak", () => {
  const summary = summarizeSmartReview({
    blockingIssues: [
      issue({ kind: "NUMERIC_CONTRADICTION", detail: "VALUE_MISMATCH. 80 matches no verified indicator value this period", claimId: "c1" }),
    ],
    claimTextById: new Map([["c1", "OUT-3 is shown as 8,450 beneficiaries."]]),
  });
  const item = summary.items[0];
  assert.equal(item.title, "A reported figure doesn't match your approved data");
  assert.ok(!/VALUE_MISMATCH|ASSERTION|SUM:neutral|reason code/i.test(item.explanation), "explanation must be clean");
  assert.ok(!/assertion|assurance|verification strategy/i.test(item.title + item.explanation));
  assert.ok(item.explanation.includes("8,450"), "clean statement text is shown, not the technical detail");
});

test("Smart Review: blocking issues appear before non-blocking issues", () => {
  const summary = summarizeSmartReview({
    blockingIssues: [
      issue({ kind: "UNSUPPORTED_MATERIAL_CLAIM", claimId: "c2" }), // blocks submit, not approval
      issue({ kind: "NUMERIC_CONTRADICTION", claimId: "c1" }),      // blocks approval
      issue({ kind: "ASSERTION_COVERAGE_GAP", sectionId: "s1" }),   // blocks approval
    ],
  });
  const first = summary.items[0];
  assert.equal(first.blocksApproval, true, "a blocking item must come first");
  assert.ok(summary.items[0].blocksApproval && summary.items[1].blocksApproval);
  assert.equal(summary.items[2].blocksApproval, false, "non-blocking issue last");
});

test("Smart Review: each item links to the relevant section/claim/evidence", () => {
  const summary = summarizeSmartReview({
    blockingIssues: [
      issue({ kind: "NUMERIC_CONTRADICTION", claimId: "c1", sectionId: "s1", evidenceId: "e1" }),
      issue({ kind: "REQUIREMENT_UNSATISFIED", sectionId: "s9" }),
    ],
  });
  const numeric = summary.items.find((i) => i.claimId === "c1");
  assert.equal(numeric.claimId, "c1");
  assert.equal(numeric.sectionId, "s1");
  assert.equal(numeric.evidenceId, "e1");
  const req = summary.items.find((i) => i.action.type === "complete-section");
  assert.equal(req.sectionId, "s9");
});

test("Smart Review: empty state", () => {
  const summary = summarizeSmartReview({ blockingIssues: [] });
  assert.equal(summary.issueCount, 0);
  assert.equal(summary.blockingCount, 0);
  assert.deepEqual(summary.items, []);
});

test("Smart Review: action integrity — a resolved claim no longer surfaces (source reflects resolution)", () => {
  // Before resolution the gate emits the claim as a blocking issue.
  const before = summarizeSmartReview({ blockingIssues: [issue({ kind: "UNSUPPORTED_MATERIAL_CLAIM", claimId: "c1" })] });
  assert.equal(before.issueCount, 1);

  // After accept-with-note, P0-1 reconciliation means the gate no longer emits
  // that claim (it is resolved), so Smart Review is empty for it.
  const after = summarizeSmartReview({ blockingIssues: [] });
  assert.equal(after.issueCount, 0);
});

test("a figure conflict from the contradiction check explains which figure, not only which section (demo 7)", () => {
  const summary = summarizeSmartReview({
    blockingIssues: [{ kind: "NUMERIC_CONTRADICTION", detail: 'Activities: The section states "31" but this figure does not appear in the verified data.', sectionId: "s1" }],
    sectionTitleById: new Map([["s1", "Activities"]]),
  });
  assert.match(summary.items[0].explanation, /states "31"/);
});
