import assert from "node:assert/strict";
import test from "node:test";
import {
  suggestNumericReplacement,
  formatLike,
  parseDecimal,
  staleSynthesisSectionIds,
  wordChangeRatio,
  sectionRegenerationBlock,
  normalizeSectionInstruction,
  SECTION_REGENERATIONS_PER_HOUR,
  ReportClaim,
  ReportSection,
  omitExcludedStatements,
} from "../dist/index.js";

// ---------------------------------------------------------------------------
// B3 — numeric correction from evidence
// ---------------------------------------------------------------------------

const failed = { verificationResult: "FAILED", verificationReasonCode: "VALUE_MISMATCH" };

test("suggests the single evidence value that is also a verified finding", () => {
  const s = suggestNumericReplacement({
    ...failed,
    claimText: "The project reached 12,400 households with clean water.",
    sources: [{ evidenceId: "ev-1", sourceText: "Distribution log: 11,860 households received kits by 30 June 2026." }],
    findings: [{ value: "11860" }],
  });
  assert.deepEqual(s, { from: "12,400", to: "11,860", evidenceId: "ev-1" });
});

test("no suggestion when the evidence holds two candidate values", () => {
  const s = suggestNumericReplacement({
    ...failed,
    claimText: "The project reached 12,400 households.",
    sources: [{ evidenceId: "ev-1", sourceText: "Reached 11,860 households; 9,000 in phase one." }],
    findings: [{ value: "11860" }, { value: "9000" }],
  });
  assert.equal(s, null);
});

test("no suggestion unless the failure is a value mismatch", () => {
  const s = suggestNumericReplacement({
    verificationResult: "FAILED",
    verificationReasonCode: "PERIOD_MISMATCH",
    claimText: "The project reached 12,400 households.",
    sources: [{ evidenceId: "ev-1", sourceText: "11,860 households" }],
    findings: [{ value: "11860" }],
  });
  assert.equal(s, null);
});

test("evidence numbers that are not verified findings are never suggested", () => {
  const s = suggestNumericReplacement({
    ...failed,
    claimText: "The project reached 12,400 households.",
    sources: [{ evidenceId: "ev-1", sourceText: "11,860 households" }],
    findings: [{ value: "500" }],
  });
  assert.equal(s, null);
});

test("percent and plain numbers are not mixed; cumulative values count as verified", () => {
  const s = suggestNumericReplacement({
    ...failed,
    claimText: "Attendance reached 91% across 40 schools.",
    sources: [{ evidenceId: "ev-2", sourceText: "Attendance: 87% (40 schools); 1,200 pupils" }],
    findings: [{ value: "40", cumulativeValue: "87" }, { value: "1200" }],
  });
  assert.deepEqual(s, { from: "91", to: "87", evidenceId: "ev-2" });
});

test("two wrong numbers in one statement are ambiguous", () => {
  const s = suggestNumericReplacement({
    ...failed,
    claimText: "The project reached 12,400 households and 310 schools.",
    sources: [{ evidenceId: "ev-1", sourceText: "11,860 households" }],
    findings: [{ value: "11860" }],
  });
  assert.equal(s, null);
});

test("formatLike keeps thousands separators only when the original used them", () => {
  assert.equal(formatLike("12,400", parseDecimal("1186000.5")), "1,186,000.5");
  assert.equal(formatLike("12400", parseDecimal("11860")), "11860");
});

// ---------------------------------------------------------------------------
// U31 — summary freshness
// ---------------------------------------------------------------------------

const t = (minutes) => new Date(Date.UTC(2026, 8, 27, 10, minutes));
const sections = [
  { id: "sum", title: "Executive summary", currentRevisionId: "sum-1" },
  { id: "ctx", title: "Project context", currentRevisionId: "ctx-2" },
];

test("a regenerated section makes the executive summary stale", () => {
  const revisions = [
    { id: "ctx-1", sectionId: "ctx", revisionNumber: 1, content: "Floods hit the district.", changeOrigin: "GENERATION", createdAt: t(0) },
    { id: "sum-1", sectionId: "sum", revisionNumber: 1, content: "Summary.", changeOrigin: "GENERATION", createdAt: t(1) },
    { id: "ctx-2", sectionId: "ctx", revisionNumber: 2, content: "Floods hit the district.", changeOrigin: "REGENERATION", createdAt: t(5) },
  ];
  assert.deepEqual(staleSynthesisSectionIds(sections, revisions), ["sum"]);
});

test("a typo fix does not make the summary stale; a heavy edit does", () => {
  const base = "Floods hit the district in March and damaged forty water points across three villages.";
  const light = [
    { id: "ctx-1", sectionId: "ctx", revisionNumber: 1, content: base, changeOrigin: "GENERATION", createdAt: t(0) },
    { id: "sum-1", sectionId: "sum", revisionNumber: 1, content: "Summary.", changeOrigin: "GENERATION", createdAt: t(1) },
    { id: "ctx-2", sectionId: "ctx", revisionNumber: 2, content: base.replace("damaged", "damagd"), changeOrigin: "MANUAL_EDIT", createdAt: t(5) },
  ];
  assert.deepEqual(staleSynthesisSectionIds(sections, light), []);
  const heavy = light.map((r) => (r.id === "ctx-2" ? { ...r, content: "Drought reduced harvests; the response moved to cash transfers for 600 families." } : r));
  assert.deepEqual(staleSynthesisSectionIds(sections, heavy), ["sum"]);
});

test("changes made before the summary was written never flag it", () => {
  const revisions = [
    { id: "ctx-2", sectionId: "ctx", revisionNumber: 2, content: "x", changeOrigin: "REGENERATION", createdAt: t(0) },
    { id: "sum-1", sectionId: "sum", revisionNumber: 1, content: "Summary.", changeOrigin: "GENERATION", createdAt: t(1) },
  ];
  assert.deepEqual(staleSynthesisSectionIds(sections, revisions), []);
});

test("wordChangeRatio is 0 for identical text and 1 for disjoint text", () => {
  assert.equal(wordChangeRatio("a b c", "a b c"), 0);
  assert.equal(wordChangeRatio("a b", "c d"), 1);
});

// ---------------------------------------------------------------------------
// B7 — single-section regeneration guards
// ---------------------------------------------------------------------------

const allowed = { draftStatus: "DRAFT", draftSuperseded: false, sectionStatuses: ["DRAFTED", "APPROVED"], sectionAlreadyRegenerating: false, recentRegenerations: 0 };

test("regeneration is allowed on a settled draft", () => {
  assert.equal(sectionRegenerationBlock(allowed), null);
});

test("regeneration guards: superseded, not a draft, generating, busy, rate limit", () => {
  assert.equal(sectionRegenerationBlock({ ...allowed, draftSuperseded: true }), "DRAFT_SUPERSEDED");
  assert.equal(sectionRegenerationBlock({ ...allowed, draftStatus: "UNDER_REVIEW" }), "DRAFT_NOT_EDITABLE");
  assert.equal(sectionRegenerationBlock({ ...allowed, sectionStatuses: ["DRAFTED", "NOT_STARTED"] }), "GENERATION_IN_PROGRESS");
  assert.equal(sectionRegenerationBlock({ ...allowed, sectionAlreadyRegenerating: true }), "SECTION_BUSY");
  assert.equal(sectionRegenerationBlock({ ...allowed, recentRegenerations: SECTION_REGENERATIONS_PER_HOUR }), "RATE_LIMITED");
});

test("instructions are trimmed and blank instructions dropped", () => {
  assert.equal(normalizeSectionInstruction("  Focus on floods "), "Focus on floods");
  assert.equal(normalizeSectionInstruction("   "), undefined);
  assert.equal(normalizeSectionInstruction(undefined), undefined);
});

// ---------------------------------------------------------------------------
// Claim reopen + section version
// ---------------------------------------------------------------------------

test("a resolved claim can be reopened; the verification result is unchanged", () => {
  const claim = ReportClaim.create({ id: "c1", tenantId: "t", projectId: "p", reportDraftId: "d", sectionId: "s", text: "We reached 10 schools.", type: "NUMERIC", verificationResult: "FAILED" });
  claim.resolve({ result: "EXCLUDED", notes: "not needed", by: "u1" });
  claim.reopen();
  assert.equal(claim.resolvedById, undefined);
  assert.equal(claim.resolutionNotes, undefined);
  assert.equal(claim.verificationResult, "FAILED");
  assert.throws(() => claim.reopen(), /Only a resolved claim/);
});

test("a rehydrated section keeps its stored updatedAt as its version", () => {
  const createdAt = new Date("2026-09-01T00:00:00.000Z");
  const updatedAt = new Date("2026-09-20T12:30:00.000Z");
  const section = ReportSection.rehydrate({
    id: "s1",
    tenantId: "t",
    reportDraftId: "d",
    createdAt,
    updatedAt,
    props: { sectionTitle: "A", sectionOrder: 0, content: "", sourceReferences: [], unsupportedClaims: [], status: "DRAFTED" },
  });
  assert.equal(section.updatedAt.toISOString(), updatedAt.toISOString());
});

// ---------------------------------------------------------------------------
// Leave out (EXCLUDED)
// ---------------------------------------------------------------------------

test("leaving a statement out records EXCLUDED; undo restores FAILED; re-checks keep it excluded", () => {
  const claim = ReportClaim.create({ id: "c1", tenantId: "t", projectId: "p", reportDraftId: "d", sectionId: "s", text: "We reached 10 schools.", type: "NUMERIC", verificationResult: "FAILED" });
  claim.resolve({ result: "EXCLUDED", by: "u1" });
  assert.equal(claim.verificationResult, "EXCLUDED");
  claim.reopen();
  assert.equal(claim.verificationResult, "FAILED");

  const reverified = ReportClaim.create({ id: "c2", tenantId: "t", projectId: "p", reportDraftId: "d", sectionId: "s", text: "We reached 10 schools.", type: "NUMERIC", verificationResult: "FAILED" });
  reverified.preserveResolution("u1", undefined, true);
  assert.equal(reverified.verificationResult, "EXCLUDED");
  const accepted = ReportClaim.create({ id: "c3", tenantId: "t", projectId: "p", reportDraftId: "d", sectionId: "s", text: "x", type: "FACTUAL", verificationResult: "FAILED" });
  accepted.preserveResolution("u1", "note", false);
  assert.equal(accepted.verificationResult, "FAILED");
});

test("exports omit left-out statements and tidy the whitespace", () => {
  const content = "Floods hit the district. We reached 10 schools. Water points were repaired.\n\n- A list item";
  const out = omitExcludedStatements(content, [
    { text: "We reached 10 schools.", verificationResult: "EXCLUDED" },
    { text: "Floods hit the district.", verificationResult: "FAILED" },
    { text: "Not in the text.", verificationResult: "EXCLUDED" },
  ]);
  assert.equal(out, "Floods hit the district. Water points were repaired.\n\n- A list item");
});
