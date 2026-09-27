import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEditorModel, editorPhase, type EditorModelInput } from "../../src/features/report-editor/application/editor-model.ts";
import { buildReportChecks } from "../../src/features/report-editor/application/report-checks.ts";
import { nextPrimaryAction } from "../../src/features/report-editor/application/primary-action.ts";
import { parseEditorUrlState, serializeEditorUrlState } from "../../src/features/report-editor/application/url-state.ts";
import { isReportEditorV2Enabled } from "../../src/lib/shared/feature-flags.ts";

const caps = { canGenerate: true, canEdit: true, canApproveSection: true, canApproveReport: true, canExport: true };

function input(overrides: Partial<EditorModelInput> = {}): EditorModelInput {
  return {
    projectId: "p1",
    periodId: "r1",
    sections: [
      { id: "s1", sectionTitle: "Executive summary", status: "DRAFTED" },
      { id: "s2", sectionTitle: "Context", status: "APPROVED" },
      { id: "s3", sectionTitle: "Challenges", status: "DRAFTED" },
    ],
    claims: [
      { id: "c2", sectionId: "s3", verificationResult: "FAILED" },
      { id: "c1", sectionId: "s1", verificationResult: "FAILED" },
      { id: "c3", sectionId: "s1", verificationResult: "PASSED" },
      { id: "c4", sectionId: "s1", verificationResult: "FAILED", resolvedById: "u1" },
    ],
    checklist: [],
    unverifiedIndicatorCount: 0,
    sensitiveEvidenceCount: 0,
    smartReviewItems: [],
    draftStatus: "DRAFT",
    generating: false,
    readinessPercent: 42.4,
    capabilities: caps,
    ...overrides,
  };
}

test("phase derivation", () => {
  assert.equal(editorPhase(null, false), "EMPTY");
  assert.equal(editorPhase("DRAFT", true), "GENERATING");
  assert.equal(editorPhase("DRAFT", false), "DRAFT");
  assert.equal(editorPhase("UNDER_REVIEW", false), "UNDER_REVIEW");
  assert.equal(editorPhase("EXPORTED", false), "APPROVED");
});

test("open statements are counted per section and block section approval", () => {
  const model = buildEditorModel(input());
  const [s1, s2, s3] = model.sections;
  assert.equal(s1!.openStatements, 1);
  assert.equal(s1!.canApprove, false);
  assert.match(s1!.approveBlockedReason ?? "", /flagged statement/);
  assert.equal(s2!.isApproved, true);
  assert.equal(s2!.approveBlockedReason, undefined);
  assert.equal(s3!.openStatements, 1);
  assert.equal(model.approvedCount, 1);
  assert.equal(model.readiness.percent, 42);
});

test("primary action walks the workflow", () => {
  let model = buildEditorModel(input());
  assert.equal(model.primary.kind, "review-statements");
  assert.equal(model.primary.kind === "review-statements" && model.primary.claimId, "c1", "first flag in document order");
  assert.equal(model.primary.kind === "review-statements" && model.primary.label, "Review 2 flagged statements");

  model = buildEditorModel(input({ claims: [] }));
  assert.equal(model.primary.kind, "approve-sections");
  assert.equal(model.primary.kind === "approve-sections" && model.primary.label, "Approve 2 remaining sections");

  const allApproved = input({ claims: [], sections: [{ id: "s1", sectionTitle: "A", status: "APPROVED" }] });
  assert.equal(buildEditorModel(allApproved).primary.kind, "submit");

  const withCritical = { ...allApproved, checklist: [{ id: "k1", title: "Annex B", severity: "HIGH", status: "OPEN" }] };
  const blocked = buildEditorModel(withCritical).primary;
  assert.equal(blocked.kind, "finish-checks");
  assert.equal(blocked.kind === "finish-checks" && blocked.label, "Finish 1 remaining check");

  assert.equal(buildEditorModel(input({ draftStatus: "UNDER_REVIEW" })).primary.kind, "approve-report");
  assert.equal(
    buildEditorModel(input({ draftStatus: "UNDER_REVIEW", capabilities: { ...caps, canApproveReport: false } })).primary.kind,
    "waiting",
  );
  assert.equal(buildEditorModel(input({ draftStatus: "APPROVED" })).primary.kind, "export");
  assert.equal(buildEditorModel(input({ draftStatus: null, sections: [], claims: [] })).primary.kind, "generate");
  assert.equal(buildEditorModel(input({ generating: true })).primary.kind, "none");
});

test("modes: author, reviewer, readonly", () => {
  assert.equal(buildEditorModel(input()).mode, "author");
  assert.equal(buildEditorModel(input({ draftStatus: "UNDER_REVIEW" })).mode, "reviewer");
  assert.equal(buildEditorModel(input({ capabilities: { ...caps, canEdit: false } })).mode, "readonly");
});

test("sections still being written are neither counted nor approvable", () => {
  const model = buildEditorModel(input({ claims: [], sections: [{ id: "s1", sectionTitle: "A", status: "NOT_STARTED" }, { id: "s2", sectionTitle: "B", status: "APPROVED" }] }));
  assert.equal(model.sections[0]!.canApprove, false);
  assert.equal(model.primary.kind, "submit");
});

test("checks: one list, blocking first, no duplicate statement items from Smart Review", () => {
  const checks = buildReportChecks({
    ...input(),
    checklist: [
      { id: "k1", title: "Annex B", severity: "LOW", status: "OPEN" },
      { id: "k2", title: "Signed cover letter", severity: "CRITICAL", status: "OPEN" },
      { id: "k3", title: "Done item", severity: "CRITICAL", status: "RESOLVED" },
    ],
    unverifiedIndicatorCount: 2,
    sensitiveEvidenceCount: 1,
    smartReviewItems: [
      { id: "x1", severity: "BLOCKING", title: "Claim", explanation: "dup", claimId: "c1", action: { type: "review-claim", label: "Review" } },
      { id: "x2", severity: "WARNING", title: "Section incomplete", explanation: "dup", sectionId: "s1", action: { type: "complete-section", label: "Complete" } },
      { id: "x3", severity: "WARNING", title: "Evidence not verified", explanation: "Verify file", evidenceId: "e1", action: { type: "review-evidence", label: "Review file" } },
    ],
  });
  assert.deepEqual(
    checks.map((c) => c.id),
    ["statements", "sections", "checklist-critical", "checklist-minor", "indicators", "sensitive-evidence", "smart-x3"],
  );
  assert.equal(checks.find((c) => c.id === "checklist-critical")!.detail, "Signed cover letter");
  assert.deepEqual(checks.find((c) => c.id === "smart-x3")!.target, { kind: "href", href: "/projects/p1/evidence/e1" });
  const sections = checks.find((c) => c.id === "sections")!;
  assert.deepEqual(sections.target, { kind: "section", sectionId: "s1" });
});

test("sections check prefers a section that can be approved now", () => {
  const checks = buildReportChecks({ ...input(), claims: [{ id: "c1", sectionId: "s1", verificationResult: "FAILED" }] });
  assert.deepEqual(checks.find((c) => c.id === "sections")!.target, { kind: "section", sectionId: "s3" });
});

test("primary action with no edit permission in draft suggests nothing", () => {
  assert.deepEqual(
    nextPrimaryAction({ phase: "DRAFT", canGenerate: false, canEdit: false, canApprove: false, canExport: false, checks: [], unapprovedSectionCount: 1, openStatementCount: 0 }),
    { kind: "none" },
  );
});

test("url state parses, validates and round-trips while keeping other params", () => {
  const parsed = parseEditorUrlState(new URLSearchParams("section=abc-123&panel=sources&claim=c_1&editor=v2"));
  assert.deepEqual(parsed, { section: "abc-123", panel: "sources", claim: "c_1" });
  assert.deepEqual(parseEditorUrlState({ section: "bad id!", panel: "nope" }), { section: undefined, panel: undefined, claim: undefined });
  const qs = serializeEditorUrlState({ section: "s2", panel: "comments" }, new URLSearchParams("editor=v2&view=check&claim=old"));
  assert.equal(qs, "editor=v2&section=s2&panel=comments");
  assert.equal(serializeEditorUrlState({}), "");
});

test("report editor v2 flag: query overrides env", () => {
  assert.equal(isReportEditorV2Enabled(undefined, undefined), false);
  assert.equal(isReportEditorV2Enabled(undefined, "1"), true);
  assert.equal(isReportEditorV2Enabled(undefined, "TRUE"), true);
  assert.equal(isReportEditorV2Enabled("classic", "1"), false);
  assert.equal(isReportEditorV2Enabled("v2", undefined), true);
});
