import { test } from "node:test";
import assert from "node:assert/strict";
import { getSchema, resolveExtensions } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { MarkdownManager } from "@tiptap/markdown";
import { anchorClaims, clipToBlock, locatePlainText, searchIndex } from "../../src/features/report-editor/application/claim-anchors.ts";
import { statementState, isOpenStatement } from "../../src/features/report-editor/application/statements.ts";
import { buildIssueList, currentIssueKey, stepIssue } from "../../src/features/report-editor/application/issue-order.ts";
import { shortcutFor, isTypingTarget } from "../../src/features/report-editor/application/shortcuts.ts";
import { matchVerifiedTables, parseMarkdownTables } from "../../src/features/report-editor/application/verified-tables.ts";
import { rehypeClaimHighlights, rehypeMarkVerifiedTables } from "../../src/features/report-editor/application/highlight-hast.ts";
import { buildReportChecks } from "../../src/features/report-editor/application/report-checks.ts";
import { buildEditorModel, type EditorModelInput } from "../../src/features/report-editor/application/editor-model.ts";
import { parseEditorUrlState } from "../../src/features/report-editor/application/url-state.ts";
import { buildClaimDecorations } from "../../src/features/report-editor/rich-text/claim-highlights.ts";
import { reportEditorExtensions } from "../../src/features/report-editor/rich-text/extensions.ts";

// ---------------------------------------------------------------------------
// Statement state (aligned with the server approval gate)
// ---------------------------------------------------------------------------

test("statement state: only material, failed, undecided statements are open", () => {
  assert.equal(statementState({ verificationResult: "FAILED", materiality: "MATERIAL" }), "open");
  assert.equal(statementState({ verificationResult: "FAILED" }), "open", "unknown materiality counts as material");
  assert.equal(statementState({ verificationResult: "FAILED", materiality: "NOT_MATERIAL" }), "minor");
  assert.equal(statementState({ verificationResult: "FAILED", resolvedById: "u1" }), "kept");
  assert.equal(statementState({ verificationResult: "EXCLUDED", resolvedById: "u1" }), "left-out");
  assert.equal(statementState({ verificationResult: "PASSED" }), "verified");
  assert.equal(isOpenStatement({ verificationResult: "FAILED", materiality: "NOT_MATERIAL" }), false);
});

// ---------------------------------------------------------------------------
// Claim anchors (§4.3)
// ---------------------------------------------------------------------------

const MD = "Intro sentence.\n\nThe project reached **12,400** households with [clean water](https://x.org). Later text.\n\n| Area | Result |\n| --- | --- |\n| North | 400 wells built |";

test("anchors: the verifier span is used when it still holds the statement", () => {
  const text = "Intro sentence.";
  const anchors = anchorClaims(MD, [{ id: "c1", text, charStart: 0, charEnd: text.length }]);
  assert.deepEqual(anchors.get("c1"), { start: 0, end: 15 });
});

test("anchors: stale offsets fall back to search; formatting inside the statement is tolerated", () => {
  const anchors = anchorClaims(MD, [{ id: "c1", text: "The project reached 12,400 households with clean water.", charStart: 3, charEnd: 9 }]);
  const a = anchors.get("c1")!;
  assert.ok(a);
  assert.equal(MD.slice(a.start, a.end), "The project reached **12,400** households with [clean water](https://x.org).");
});

test("anchors: case and whitespace insensitive; unanchored when the wording changed", () => {
  const anchors = anchorClaims(MD, [
    { id: "c1", text: "intro   SENTENCE." },
    { id: "c2", text: "This sentence is not in the section." },
  ]);
  assert.equal(MD.slice(anchors.get("c1")!.start, anchors.get("c1")!.end), "Intro sentence.");
  assert.equal(anchors.get("c2"), null);
});

test("anchors: duplicate text goes to the first unused match", () => {
  const md = "We built 4 wells. We built 4 wells.";
  const anchors = anchorClaims(md, [
    { id: "a", text: "We built 4 wells." },
    { id: "b", text: "We built 4 wells." },
  ]);
  assert.deepEqual([anchors.get("a")!.start, anchors.get("b")!.start], [0, 18]);
});

test("anchors never cross a line or a table cell", () => {
  assert.deepEqual(clipToBlock("one\ntwo", { start: 0, end: 7 }), { start: 0, end: 3 });
  const cellStart = MD.indexOf("North");
  const clipped = clipToBlock(MD, { start: cellStart, end: MD.length });
  assert.equal(MD.slice(clipped.start, clipped.end), "North");
});

test("searchIndex strips inline markup and keeps offsets; locatePlainText includes hugging markers", () => {
  const index = searchIndex("A **b** [c](u)");
  assert.equal(index.text, "a b c");
  assert.deepEqual(index.offsets, [0, 1, 4, 7, 9]);
  const md = "Reached **12,400** households.";
  const range = locatePlainText(md, "12,400")!;
  assert.equal(md.slice(range.start, range.end), "**12,400**");
  assert.equal(locatePlainText(md, "absent"), null);
});

// ---------------------------------------------------------------------------
// Static-view highlights (rehype) and editor decorations
// ---------------------------------------------------------------------------

type H = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: H[]; position?: { start: { offset: number }; end: { offset: number } } };
const text = (value: string, start: number): H => ({ type: "text", value, position: { start: { offset: start }, end: { offset: start + value.length } } });

test("highlights split text nodes by source offsets; only the first mark is a tab stop", () => {
  const source = "Reached **12,400** homes.";
  const tree: H = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        children: [text("Reached ", 0), { type: "element", tagName: "strong", children: [text("12,400", 10)] }, text(" homes.", 18)],
      },
    ],
  };
  rehypeClaimHighlights({ source, highlights: [{ claimId: "c1", start: 0, end: 25, tone: "open", label: "Needs a decision" }], focusedId: "c1" })(tree as never);
  const p = tree.children![0]!;
  const marks = [p.children![0]!, p.children![1]!.children![0]!, p.children![2]!];
  assert.ok(marks.every((m) => m.tagName === "span" && m.properties?.dataClaimId === "c1"));
  assert.equal(marks[0]!.properties?.tabIndex, 0);
  assert.equal(marks[1]!.properties?.tabIndex, undefined);
  assert.equal(marks[0]!.properties?.dataClaimFocused, "true");
});

test("highlights keep text outside the statement unmarked", () => {
  const source = "One. Two three.";
  const tree: H = { type: "root", children: [{ type: "element", tagName: "p", children: [text(source, 0)] }] };
  rehypeClaimHighlights({ source, highlights: [{ claimId: "c", start: 5, end: 15, tone: "kept", label: "x" }] })(tree as never);
  const kids = tree.children![0]!.children!;
  assert.deepEqual(kids.map((k) => k.type === "text" ? k.value : `[${k.children![0]!.value}]`), ["One. ", "[Two three.]"]);
});

test("verified tables are marked by index", () => {
  const tree: H = { type: "root", children: [{ type: "element", tagName: "table", children: [] }, { type: "element", tagName: "table", children: [] }] };
  rehypeMarkVerifiedTables({ verified: new Set([1]), drifted: new Set([1]) })(tree as never);
  assert.equal(tree.children![0]!.properties, undefined);
  assert.equal(tree.children![1]!.properties?.dataVerifiedTable, "changed");
});

test("editor decorations find statements per paragraph and ignore formatting", () => {
  const extensions = resolveExtensions(reportEditorExtensions());
  const manager = new MarkdownManager({ extensions, indentation: { style: "space", size: 2 } });
  const doc = PMNode.fromJSON(getSchema(extensions), manager.parse("First paragraph.\n\nWe reached **12,400** homes."));
  const set = buildClaimDecorations(doc, [
    { claimId: "c1", text: "We reached 12,400 homes.", tone: "open" },
    { claimId: "c2", text: "Not present.", tone: "open" },
  ]);
  const found = set.find();
  assert.equal(found.length, 1);
  assert.equal(doc.textBetween(found[0]!.from, found[0]!.to), "We reached 12,400 homes.");
});

// ---------------------------------------------------------------------------
// Issue navigator
// ---------------------------------------------------------------------------

test("issues run in document order and wrap; re-check sections follow their statements", () => {
  const issues = buildIssueList(
    [
      { id: "s1", needsRecheck: false },
      { id: "s2", needsRecheck: true },
      { id: "s3", needsRecheck: false },
    ],
    [
      { id: "c3", sectionId: "s3", position: 5 },
      { id: "c1b", sectionId: "s1", position: 40 },
      { id: "c1a", sectionId: "s1", position: 10 },
      { id: "c1u", sectionId: "s1", position: null },
    ],
  );
  assert.deepEqual(issues.map((i) => i.key), ["claim:c1a", "claim:c1b", "claim:c1u", "section:s2", "claim:c3"]);
  assert.equal(stepIssue(issues, undefined, 1)!.key, "claim:c1a");
  assert.equal(stepIssue(issues, undefined, -1)!.key, "claim:c3");
  assert.equal(stepIssue(issues, "claim:c3", 1)!.key, "claim:c1a");
  assert.equal(currentIssueKey(issues, { claim: "c1b", section: "s1" }), "claim:c1b");
  assert.equal(currentIssueKey(issues, { section: "s2" }), "section:s2");
  assert.equal(stepIssue([], undefined, 1), null);
});

// ---------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------

test("shortcuts: single keys only, never with modifiers or while typing", () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });
  assert.equal(shortcutFor(key("j")), "next-section");
  assert.equal(shortcutFor(key("N")), "prev-issue");
  assert.equal(shortcutFor(key("?")), "help");
  assert.equal(shortcutFor(key("k", { metaKey: true })), null);
  assert.equal(shortcutFor(key("x")), null);
  assert.equal(isTypingTarget({ tagName: "textarea" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", closest: (s: string) => (s.includes("dialog") ? {} : null) }), true);
  assert.equal(isTypingTarget({ tagName: "BUTTON", closest: () => null }), false);
  assert.equal(isTypingTarget(null), false);
});

// ---------------------------------------------------------------------------
// Verified tables
// ---------------------------------------------------------------------------

const TABLE_ARTIFACT = {
  id: "a1",
  kind: "TABLE",
  payload: {
    columns: [{ key: "i", label: "Indicator" }, { key: "t", label: "Target" }, { key: "a", label: "Achieved" }],
    rows: [{ cells: ["OUT-1 Wells", 2000, 1680] }, { cells: ["OUT-2 Latrines", 400, 248] }],
  },
};

test("tables built from verified data are recognised and changed numbers counted", () => {
  const clean = "Intro\n\n| Indicator | Target | Achieved |\n| --- | --- | --- |\n| OUT-1 Wells | 2,000 | 1,680 |\n| OUT-2 Latrines | 400 | 248 |";
  assert.deepEqual(matchVerifiedTables(clean, [TABLE_ARTIFACT]), [{ tableIndex: 0, changedNumbers: 0 }]);
  const edited = clean.replace("1,680", "1,800");
  assert.deepEqual(matchVerifiedTables(edited, [TABLE_ARTIFACT]), [{ tableIndex: 0, changedNumbers: 1 }]);
  const other = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  assert.deepEqual(matchVerifiedTables(other, [TABLE_ARTIFACT]), []);
  assert.equal(parseMarkdownTables(`${other}\n\ntext\n\n${clean}`).length, 2);
  assert.deepEqual(matchVerifiedTables(clean, [{ kind: "TABLE", payload: {} }]), [], "malformed artifacts are ignored");
});

// ---------------------------------------------------------------------------
// Checks and model additions (re-check, comments, inputs changed, summary)
// ---------------------------------------------------------------------------

const caps = { canGenerate: true, canEdit: true, canApproveSection: true, canApproveReport: true, canExport: true };

function input(overrides: Partial<EditorModelInput> = {}): EditorModelInput {
  return {
    projectId: "p1",
    periodId: "r1",
    sections: [
      { id: "s1", sectionTitle: "Executive summary", status: "DRAFTED", content: "Text", assuranceState: "CURRENT" },
      { id: "s2", sectionTitle: "Context", status: "NEEDS_REVIEW", content: "Text", assuranceState: "STALE" },
      { id: "s3", sectionTitle: "Results", status: "DRAFTED", content: "", assuranceState: null },
    ],
    claims: [{ id: "c1", sectionId: "s2", verificationResult: "FAILED", materiality: "NOT_MATERIAL" }],
    checklist: [],
    unverifiedIndicatorCount: 0,
    sensitiveEvidenceCount: 0,
    draftStatus: "DRAFT",
    generating: false,
    readinessPercent: 50,
    capabilities: caps,
    ...overrides,
  };
}

test("a stale section without open statements needs a re-check and cannot be approved", () => {
  const model = buildEditorModel(input());
  const [s1, s2, s3] = model.sections;
  assert.equal(s1!.canApprove, true);
  assert.equal(s2!.needsRecheck, true, "a NOT_MATERIAL failure does not count as an open statement");
  assert.equal(s2!.openStatements, 0);
  assert.match(s2!.approveBlockedReason ?? "", /Re-check/);
  assert.equal(s3!.hasContent, false);
  assert.match(s3!.approveBlockedReason ?? "", /Write this section/);
  assert.deepEqual(model.approvableIds, ["s1"]);
  const recheck = model.checks.find((c) => c.id === "recheck")!;
  assert.equal(recheck.severity, "BLOCKING");
  assert.deepEqual(recheck.target, { kind: "recheck", sectionIds: ["s2"] });
  assert.equal(model.primary.kind, "approve-sections");
  assert.equal(model.primary.kind === "approve-sections" && model.primary.sectionId, "s1");
});

test("with nothing approvable the primary action asks to finish checks", () => {
  const model = buildEditorModel(input({ sections: [{ id: "s2", sectionTitle: "Context", status: "NEEDS_REVIEW", content: "Text", assuranceState: "STALE" }] }));
  assert.equal(model.primary.kind, "finish-checks");
});

test("regenerating sections, stale summaries and comments reach the model and checks", () => {
  const model = buildEditorModel(
    input({
      regeneratingSectionIds: ["s1"],
      staleSummaryIds: ["s1"],
      commentCounts: { s1: 2, s3: 1 },
      inputsChanged: { indicators: 2, evidence: 0, sectionIds: ["s1"] },
      driftedTableSectionIds: ["s3"],
    }),
  );
  const s1 = model.sections[0]!;
  assert.equal(s1.regenerating, true);
  assert.equal(s1.canApprove, false);
  assert.equal(s1.summaryStale, true);
  assert.equal(s1.commentCount, 2);
  const ids = model.checks.map((c) => c.id);
  assert.ok(ids.includes("summary-stale-s1"));
  assert.ok(ids.includes("table-drift-s3"));
  const comments = model.checks.find((c) => c.id === "comments")!;
  assert.equal(comments.title, "3 open comments");
  assert.deepEqual(comments.target, { kind: "section", sectionId: "s1", panel: "comments" });
  const changed = model.checks.find((c) => c.id === "inputs-changed")!;
  assert.equal(changed.title, "2 indicator values changed since this draft");
  assert.deepEqual(changed.target, { kind: "recheck", sectionIds: ["s1"] });
});

test("unknown assurance state never blocks (older api responses)", () => {
  const checks = buildReportChecks({
    projectId: "p",
    periodId: "r",
    sections: [{ id: "s1", sectionTitle: "A", status: "DRAFTED" }],
    claims: [],
    checklist: [],
    unverifiedIndicatorCount: 0,
    sensitiveEvidenceCount: 0,
  });
  assert.equal(checks.some((c) => c.id === "recheck"), false);
});

test("classic deep links (?view=) open the matching panel", () => {
  assert.equal(parseEditorUrlState({ view: "check" }).panel, "checks");
  assert.equal(parseEditorUrlState({ view: "review", section: "s1" }).panel, "statements");
  assert.equal(parseEditorUrlState({ view: "check", panel: "sources" }).panel, "sources", "an explicit panel wins");
  assert.equal(parseEditorUrlState({ panel: "history" }).panel, "history");
});
