import assert from "node:assert/strict";
import test from "node:test";
import { ReportSection, ReportClaim, locateClaimSpan } from "@donordesk/domain";
import {
  RegenerateReportSectionHandler,
  planSectionFor,
  ReopenReportClaimHandler,
  GetClaimSuggestionHandler,
  ListSectionRevisionsHandler,
  UpdateReportSectionHandler,
  GetReportDraftHandler,
  RewriteReportSectionHandler,
  RESTRICTED_EVIDENCE_LABEL,
  replaceNumberInSpan,
} from "../dist/index.js";

/**
 * Report Editor v2 (P3–P5) application behaviour: single-section regenerate
 * (B7), claim reopen (U7 undo), numeric suggestion (B3), section history,
 * section update guards + version, draft read additions (B1/B2/B6) and the
 * selection rewrite preview (B10).
 */

const ok = (value) => ({ ok: true, value });
const noop = async () => ok(undefined);
const ctx = (role = "ADMIN") => ({ tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role }, requestId: "r" });

function section(overrides = {}) {
  return ReportSection.rehydrate({
    id: overrides.id ?? "s1",
    tenantId: "tenant-a",
    reportDraftId: "d1",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-09-02T00:00:00.000Z"),
    props: {
      sectionTitle: overrides.title ?? "Project context",
      sectionOrder: overrides.order ?? 0,
      content: overrides.content ?? "Old text.",
      sourceReferences: overrides.sourceReferences ?? [],
      unsupportedClaims: [],
      status: overrides.status ?? "DRAFTED",
      currentRevisionId: overrides.currentRevisionId ?? "rev-1",
    },
  });
}

const draftOf = (overrides = {}) => ({
  id: "d1",
  projectId: "p1",
  reportingPeriodId: "period-1",
  status: "DRAFT",
  isSuperseded: false,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// B7 — regenerate one section
// ---------------------------------------------------------------------------

function buildRegenerate({ sections, draft = draftOf(), generated, runs = [], plan = { sections: [{ templateSectionId: "t1", title: "Project context", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] }] } } = {}) {
  const calls = { persisted: [], audits: [], drafted: [], finished: [] };
  const store = new Map(sections.map((s) => [s.id, s]));
  const running = new Set();
  const tasks = [];
  const handler = new RegenerateReportSectionHandler(
    { generate: () => "run-1" },
    { findById: async () => ok(draft) },
    { findById: async (id) => ok(store.get(id) ?? null), findByReportDraft: async () => ok([...store.values()]) },
    { findByReportingPeriod: async () => ok(plan ? [plan] : []) },
    { findByDraft: async () => ok(runs), create: async (run) => ok(run) },
    {
      loadBase: async () => ok({ period: { donorTemplateVersion: 1 }, templateVersion: 1, reportingProfileSnapshot: {}, generator: { model: { modelId: "m", promptVersion: 4, modelVersion: "v" } } }),
      loadInputs: async () => ok({ verifiedFindings: [], indicatorUpdateIds: [], activityIds: [], evidenceIds: [], evidencePackages: [], indicatorUpdates: [], activities: [], reportContext: {} }),
    },
    {
      draft: async (request, sectionId, planSection) => {
        calls.drafted.push({ request, sectionId, planSection });
        return generated;
      },
      persist: async (input) => {
        calls.persisted.push(input);
        return ok({ revisionId: "rev-2", claimCount: 0 });
      },
    },
    {
      tryStart: (id) => (running.has(id) ? false : (running.add(id), true)),
      finish: (id) => {
        running.delete(id);
        calls.finished.push(id);
      },
      runningAmong: (ids) => ids.filter((id) => running.has(id)),
    },
    { record: async (e) => { calls.audits.push(e.eventType); return ok(undefined); } },
    (task) => tasks.push(task()),
  );
  return { handler, calls, running, settle: () => Promise.all(tasks), store };
}

const aiText = { section: { content: "New text.", claims: [], sourceReferences: [] }, usedFallback: false };

test("B7: regenerates one section with the instruction and every other section as context", async () => {
  const sections = [section(), section({ id: "s2", title: "Executive summary", content: "Summary.", order: 1 })];
  const { handler, calls, settle } = buildRegenerate({ sections, generated: aiText });
  const result = await handler.handle(ctx(), "s1", { instruction: "  Focus on floods " });
  assert.ok(result.ok);
  assert.deepEqual(result.value, { sectionId: "s1", runId: "run-1" });
  await settle();
  assert.equal(calls.drafted[0].request.sectionInstruction, "Focus on floods");
  assert.deepEqual(calls.drafted[0].request.draftedSections, [{ title: "Executive summary", content: "Summary." }]);
  assert.equal(calls.persisted[0].changeOrigin, "REGENERATION");
  assert.deepEqual(calls.audits, ["report.section.regeneration_requested", "report.section.regenerated"]);
  assert.deepEqual(calls.finished, ["s1"]);
});

test("B7: a fallback keeps the previous text and records a failed run", async () => {
  const { handler, calls, settle, store } = buildRegenerate({ sections: [section()], generated: { ...aiText, usedFallback: true, fallbackReason: "PROVIDER_TIMEOUT" } });
  assert.ok((await handler.handle(ctx(), "s1", {})).ok);
  await settle();
  assert.equal(calls.persisted.length, 0);
  assert.equal(store.get("s1").content, "Old text.");
  assert.ok(calls.audits.includes("report.section.regeneration_failed"));
});

test("B7: an approved section is reopened when its new text is saved", async () => {
  const { handler, calls, settle } = buildRegenerate({ sections: [section({ status: "APPROVED" })], generated: aiText });
  assert.ok((await handler.handle(ctx(), "s1", {})).ok);
  await settle();
  assert.equal(calls.persisted[0].section.status, "DRAFTED");
  assert.ok(calls.audits.includes("report.section.reopened"));
});

test("B7: guards — draft generating, section busy, not a draft, rate limit", async () => {
  const generating = buildRegenerate({ sections: [section(), section({ id: "s2", status: "NOT_STARTED" })], generated: aiText });
  const r1 = await generating.handler.handle(ctx(), "s1", {});
  assert.equal(r1.error.code, "CONFLICT");

  const busy = buildRegenerate({ sections: [section()], generated: aiText });
  busy.running.add("s1");
  assert.equal((await busy.handler.handle(ctx(), "s1", {})).error.code, "CONFLICT");

  const review = buildRegenerate({ sections: [section()], draft: draftOf({ status: "UNDER_REVIEW" }), generated: aiText });
  assert.equal((await review.handler.handle(ctx(), "s1", {})).error.code, "INVALID_STATE_TRANSITION");

  const recent = Array.from({ length: 10 }, () => ({ createdAt: new Date(), snapshot: { generationParams: { kind: "SECTION_REGENERATION" } } }));
  const limited = buildRegenerate({ sections: [section()], generated: aiText, runs: recent });
  assert.equal((await limited.handler.handle(ctx(), "s1", {})).error.code, "POLICY_DENIED");
});

test("B7: a user-added section gets a synthetic plan section from its title", () => {
  const plan = { sections: [{ templateSectionId: "t1", title: "Project context" }] };
  assert.equal(planSectionFor(plan, { id: "s1", sectionTitle: " project CONTEXT " }).templateSectionId, "t1");
  const custom = planSectionFor(plan, { id: "s9", sectionTitle: "Partnerships" });
  assert.equal(custom.templateSectionId, "custom-s9");
  assert.equal(custom.title, "Partnerships");
  assert.deepEqual(custom.mandatoryQuestions, []);
});

// ---------------------------------------------------------------------------
// U7 — reopen a resolved claim
// ---------------------------------------------------------------------------

function resolvedClaim() {
  const claim = ReportClaim.create({ id: "c1", tenantId: "tenant-a", projectId: "p1", reportDraftId: "d1", sectionId: "s1", text: "We reached 10 schools.", type: "NUMERIC", verificationResult: "FAILED" });
  claim.resolve({ result: "EXCLUDED", notes: "not needed", by: "user-1" });
  return claim;
}

test("U7: reopening a decision clears it and reassesses the section", async () => {
  const claim = resolvedClaim();
  const assessed = [];
  const handler = new ReopenReportClaimHandler(
    { findById: async () => ok(claim), update: async (c) => ok(c) },
    { findById: async () => ok(section()) },
    { assessRevision: async (input) => { assessed.push(input.revisionId); return ok({}); } },
    { record: noop },
  );
  const result = await handler.handle(ctx(), "c1");
  assert.ok(result.ok);
  assert.equal(claim.resolvedById, undefined);
  assert.deepEqual(assessed, ["rev-1"]);
});

test("U7: an approved section's decisions cannot be undone", async () => {
  const handler = new ReopenReportClaimHandler(
    { findById: async () => ok(resolvedClaim()), update: async (c) => ok(c) },
    { findById: async () => ok(section({ status: "APPROVED" })) },
    { assessRevision: noop },
    { record: noop },
  );
  const result = await handler.handle(ctx(), "c1");
  assert.equal(result.error.code, "INVALID_STATE_TRANSITION");
});

// ---------------------------------------------------------------------------
// B3 — suggestion endpoint
// ---------------------------------------------------------------------------

test("B3: the suggestion uses the current verified findings", async () => {
  const claim = ReportClaim.create({
    id: "c1", tenantId: "tenant-a", projectId: "p1", reportDraftId: "d1", sectionId: "s1",
    text: "We reached 12,400 households.", type: "NUMERIC", verificationResult: "FAILED", verificationReasonCode: "VALUE_MISMATCH",
    sources: [{ evidenceId: "ev-1", chunkId: "k1", sourceText: "11,860 households received kits", evidenceHash: "h", evidenceUpdatedAt: new Date(), chunkerVersion: "1" }],
  });
  const handler = new GetClaimSuggestionHandler(
    { findById: async () => ok(claim) },
    { findById: async () => ok(draftOf()) },
    { computeFindings: async () => ok([{ value: "11860" }]) },
  );
  const result = await handler.handle(ctx(), "c1");
  assert.deepEqual(result.value, { suggestion: { from: "12,400", to: "11,860", evidenceId: "ev-1" } });
});

// ---------------------------------------------------------------------------
// Section history
// ---------------------------------------------------------------------------

test("section history lists revisions newest first and marks the current one", async () => {
  const revs = [1, 2, 3].map((n) => ({ id: `rev-${n}`, revisionNumber: n, changeOrigin: n === 3 ? "REGENERATION" : "MANUAL_EDIT", createdAt: new Date(), modelId: n === 3 ? "m" : undefined, content: `v${n}` }));
  const handler = new ListSectionRevisionsHandler({ findById: async () => ok(section({ currentRevisionId: "rev-3" })) }, { findBySection: async () => ok(revs) });
  const result = await handler.handle(ctx(), "s1");
  assert.deepEqual(result.value.items.map((i) => [i.revisionNumber, i.isCurrent, i.byAi]), [[3, true, true], [2, false, false], [1, false, false]]);
});

// ---------------------------------------------------------------------------
// Section update: version, guards, reopen
// ---------------------------------------------------------------------------

function buildUpdate({ current = section(), draft = draftOf() } = {}) {
  const stored = { value: current };
  const audits = [];
  const handler = new UpdateReportSectionHandler(
    {
      findById: async () => ok(stored.value),
      update: async (s) => ok(s),
    },
    { findById: async () => ok(draft) },
    {
      commitChange: async (input) => {
        input.section.setContent(input.content, input.sourceReferences, input.unsupportedClaims);
        return ok({ id: "rev-2", revisionNumber: 2 });
      },
    },
    {
      assessRevision: async () => {
        // Assurance re-marks the section (touch) after the commit.
        stored.value = section({ updatedAt: new Date("2026-09-30T00:00:00.000Z"), status: "NEEDS_REVIEW" });
        return ok({ assuranceState: "FAILED" });
      },
    },
    { record: async (e) => { audits.push(e.eventType); return ok(undefined); } },
  );
  return { handler, audits };
}

test("update returns the stored version read back after assurance", async () => {
  const { handler } = buildUpdate();
  const result = await handler.handle(ctx(), "s1", { content: "New", sourceReferences: [], unsupportedClaims: [], expectedVersion: "2026-09-02T00:00:00.000Z" });
  assert.ok(result.ok);
  assert.equal(result.value.version, "2026-09-30T00:00:00.000Z");
});

test("update rejects a stale version and edits outside a working draft", async () => {
  const stale = await buildUpdate().handler.handle(ctx(), "s1", { content: "x", sourceReferences: [], unsupportedClaims: [], expectedVersion: "2026-01-01T00:00:00.000Z" });
  assert.equal(stale.error.code, "CONFLICT");
  const review = await buildUpdate({ draft: draftOf({ status: "UNDER_REVIEW" }) }).handler.handle(ctx(), "s1", { content: "x", sourceReferences: [], unsupportedClaims: [] });
  assert.equal(review.error.code, "INVALID_STATE_TRANSITION");
  const superseded = await buildUpdate({ draft: draftOf({ isSuperseded: true }) }).handler.handle(ctx(), "s1", { content: "x", sourceReferences: [], unsupportedClaims: [] });
  assert.equal(superseded.error.code, "INVALID_STATE_TRANSITION");
});

test("a text edit keeps the section's sources when none are sent", async () => {
  const current = section({ sourceReferences: [{ type: "evidence", id: "ev-1", label: "Log" }] });
  const { handler } = buildUpdate({ current });
  assert.ok((await handler.handle(ctx(), "s1", { content: "Changed" })).ok);
  assert.deepEqual(current.sourceReferences, [{ type: "evidence", id: "ev-1", label: "Log" }]);
});

test("editing an approved section reopens it (audited)", async () => {
  const approved = section({ status: "APPROVED" });
  const { handler, audits } = buildUpdate({ current: approved });
  assert.ok((await handler.handle(ctx(), "s1", { content: "Changed", sourceReferences: [], unsupportedClaims: [] })).ok);
  assert.equal(approved.status, "DRAFTED");
  assert.deepEqual(audits, ["report.section.reopened", "report.section.updated"]);
});

// ---------------------------------------------------------------------------
// GET draft additions (B1, B2, B6, U15, U31)
// ---------------------------------------------------------------------------

function buildGetDraft({ role, changed = { indicatorIds: [], indicatorUpdateIds: [], evidenceIds: [] } }) {
  const s1 = section({ sourceReferences: [{ type: "evidence", id: "ev-1" }, { type: "indicator", id: "ind-1" }] });
  const s2 = section({ id: "s2", title: "Results", order: 1, currentRevisionId: "rev-9", sourceReferences: [] });
  const claim = ReportClaim.create({
    id: "c1", tenantId: "tenant-a", projectId: "p1", reportDraftId: "d1", sectionId: "s2", text: "Stat", type: "NUMERIC",
    verificationResult: "FAILED", verificationReasonCode: "VALUE_MISMATCH", charStart: 0, charEnd: 4,
    sources: [{ evidenceId: "ev-2", chunkId: "k", sourceText: "x", evidenceHash: "h", evidenceUpdatedAt: new Date(), chunkerVersion: "1" }],
  });
  return new GetReportDraftHandler(
    { findByReportingPeriod: async () => ok([draftOf({ title: "T", version: 1, generatedByAi: true, createdById: "u" })]) },
    { findByReportDraft: async () => ok([s1, s2]) },
    { findByDraft: async () => ok([claim]) },
    { findByDraft: async () => ok([{ id: "rev-1", sectionId: "s1", revisionNumber: 1, content: "Old text.", changeOrigin: "GENERATION", createdAt: new Date(), assuranceState: "CURRENT", modelId: "m" }]) },
    { findByReportingPeriod: async () => ok([]) },
    undefined,
    {
      evidenceDirectory: { describe: async () => ok([{ id: "ev-1", title: "Distribution log", confidentialityLevel: "INTERNAL" }, { id: "ev-2", title: "Beneficiary list", confidentialityLevel: "HIGHLY_SENSITIVE" }]) },
      inputsChangeReader: { changedSince: async () => ok(changed) },
      regenerationTracker: { runningAmong: (ids) => ids.filter((id) => id === "s2") },
      commentCounter: { countOpenByEntities: async () => ok({ s1: 2 }) },
    },
  );
}

test("GET draft exposes claim spans, materiality, labels, assurance, regenerating ids and comment counts", async () => {
  const result = await buildGetDraft({ role: "ADMIN" }).handle(ctx("ADMIN"), "period-1");
  const v = result.value;
  assert.deepEqual([v.claims[0].charStart, v.claims[0].charEnd, v.claims[0].materiality, v.claims[0].verificationReasonCode], [0, 4, "MATERIAL", "VALUE_MISMATCH"]);
  assert.equal(v.claims[0].sources[0].evidenceTitle, "Beneficiary list", "grants-level roles see restricted titles");
  assert.equal(v.sections[0].sourceReferences[0].evidenceTitle, "Distribution log");
  assert.equal(v.sections[0].assuranceState, "CURRENT");
  assert.equal(v.sections[1].assuranceState, null);
  assert.deepEqual(v.regeneratingSectionIds, ["s2"]);
  assert.deepEqual(v.commentCounts, { s1: 2 });
  assert.equal(v.inputsChangedSince, null);
});

test("B2: restricted evidence titles are masked for roles without the confidentiality authority", async () => {
  const result = await buildGetDraft({}).handle(ctx("ME_OFFICER"), "period-1");
  assert.equal(result.value.claims[0].sources[0].evidenceTitle, RESTRICTED_EVIDENCE_LABEL);
  assert.equal(result.value.sections[0].sourceReferences[0].evidenceTitle, "Distribution log");
});

test("B6: changed inputs are counted and mapped to the sections that cite them", async () => {
  const handler = buildGetDraft({ changed: { indicatorIds: ["ind-1"], indicatorUpdateIds: ["upd-1"], evidenceIds: ["ev-2"] } });
  const result = await handler.handle(ctx(), "period-1");
  assert.deepEqual(result.value.inputsChangedSince, { indicators: 1, evidence: 1, sectionIds: ["s1", "s2"] });
});

// ---------------------------------------------------------------------------
// B10 — selection rewrite preview
// ---------------------------------------------------------------------------

function buildRewrite(content) {
  const seen = [];
  const handler = new RewriteReportSectionHandler(
    { generate: () => "x" },
    { findById: async () => ok(draftOf()) },
    { findById: async () => ok(section({ content })) },
    ...Array(5).fill({}), // periods, indicator updates, activities, analytics, evidence packages
    async () => ({ model: { modelId: "m", promptVersion: 1 }, rewriteSection: async (input) => { seen.push(input); return { content: " Shorter. ", unsupportedClaims: [] }; } }),
    { commitChange: async () => { throw new Error("preview must not save"); } },
    {},
    {},
    { record: noop },
  );
  return { handler, seen };
}

test("B10: a preview rewrites only the selection and saves nothing", async () => {
  const { handler, seen } = buildRewrite("Intro. A long winded middle part. Outro.");
  const result = await handler.preview(ctx(), "s1", { mode: "SHORTEN", audience: "DONOR", selection: { from: 7, to: 33 }, preview: true });
  assert.ok(result.ok);
  assert.equal(seen[0].content, "A long winded middle part.");
  assert.match(seen[0].instructions, /excerpt/i);
  assert.deepEqual(result.value, { preview: true, content: "Shorter.", selection: { from: 7, to: 33 }, fallbackUsed: false });
});

test("B10: a selection beyond the current text is a conflict (the section changed)", async () => {
  const { handler } = buildRewrite("Short.");
  const result = await handler.preview(ctx(), "s1", { mode: "REWRITE", audience: "DONOR", selection: { from: 0, to: 50 }, preview: true });
  assert.equal(result.error.code, "CONFLICT");
});

// ---------------------------------------------------------------------------
// B5 — apply the evidence value server-side
// ---------------------------------------------------------------------------


test("B5: the verifier span is used when it still holds the statement, else the text is searched", () => {
  const content = "Intro. We reached 12,400 households. Later 12,400 again.";
  assert.deepEqual(locateClaimSpan(content, { text: "We reached 12,400 households.", charStart: 7, charEnd: 36 }), { start: 7, end: 36 });
  assert.deepEqual(locateClaimSpan(content, { text: "We reached 12,400 households.", charStart: 0, charEnd: 5 }), { start: 7, end: 36 });
  assert.equal(locateClaimSpan(content, { text: "Gone." }), null);
});

test("B5: only the number inside the statement is replaced, never a longer number", () => {
  const content = "We reached 112,400 people and 12,400 households. Later 12,400 again.";
  const span = locateClaimSpan(content, { text: "We reached 112,400 people and 12,400 households." });
  assert.equal(replaceNumberInSpan(content, span, "12,400", "11,860"), "We reached 112,400 people and 11,860 households. Later 12,400 again.");
  assert.equal(replaceNumberInSpan(content, span, "999", "1"), null);
});
