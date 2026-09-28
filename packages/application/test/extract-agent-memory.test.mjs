import assert from "node:assert/strict";
import test from "node:test";
import { ExtractAgentMemoryHandler } from "../dist/index.js";

const tenantId = { toString: () => "tenant-a" };

function makeHandler({ revisionsById, section, draft, period, extracted }) {
  const revisions = { findById: async (id) => ({ ok: true, value: revisionsById[id] ?? null }) };
  const sections = { findById: async () => ({ ok: true, value: section }) };
  const drafts = { findById: async () => ({ ok: true, value: draft }) };
  const periods = { findById: async () => ({ ok: true, value: period }) };
  const extractor = { extract: async () => ({ ok: true, value: extracted ?? [] }) };
  const proposedCalls = [];
  const agentMemory = {
    proposeMany: async (tid, candidates) => {
      proposedCalls.push({ tid, candidates });
      return { ok: true, value: candidates };
    },
  };
  const handler = new ExtractAgentMemoryHandler(revisions, sections, drafts, periods, extractor, agentMemory);
  return { handler, proposedCalls };
}

const section = { reportDraftId: "draft-1", sectionTitle: "Executive Summary" };
const draft = { reportingPeriodId: "period-1" };
const period = { donorTemplateId: undefined };

test("MANUAL_EDIT following a GENERATION revision triggers extraction and proposes candidates", async () => {
  const { handler, proposedCalls } = makeHandler({
    revisionsById: {
      "rev-2": { id: "rev-2", changeOrigin: "MANUAL_EDIT", parentRevisionId: "rev-1", content: "Edited text." },
      "rev-1": { id: "rev-1", changeOrigin: "GENERATION", content: "Original text." },
    },
    section,
    draft,
    period,
    extracted: [{ scope: "SECTION_TYPE", scopeId: "Executive Summary", category: "TONE", statement: "Prefer active voice." }],
  });

  const result = await handler.handle({ tenantId, sectionId: "sec-1", revisionId: "rev-2" });
  assert.ok(result.ok);
  assert.equal(result.value.proposed, 1);
  assert.equal(proposedCalls.length, 1);
  assert.equal(proposedCalls[0].candidates[0].provenance.sourceRevisionId, "rev-2");
  assert.equal(proposedCalls[0].candidates[0].provenance.parentRevisionId, "rev-1");
});

test("MANUAL_EDIT following a REWRITE revision also triggers extraction", async () => {
  const { handler, proposedCalls } = makeHandler({
    revisionsById: {
      "rev-2": { id: "rev-2", changeOrigin: "MANUAL_EDIT", parentRevisionId: "rev-1", content: "Edited." },
      "rev-1": { id: "rev-1", changeOrigin: "REWRITE", content: "Original." },
    },
    section,
    draft,
    period,
    extracted: [{ scope: "SECTION_TYPE", scopeId: "Executive Summary", category: "LENGTH", statement: "Keep it short." }],
  });
  const result = await handler.handle({ tenantId, sectionId: "sec-1", revisionId: "rev-2" });
  assert.ok(result.ok);
  assert.equal(proposedCalls.length, 1);
});

test("a MANUAL_EDIT of a prior MANUAL_EDIT is skipped (not a signal about AI output)", async () => {
  const { handler, proposedCalls } = makeHandler({
    revisionsById: {
      "rev-3": { id: "rev-3", changeOrigin: "MANUAL_EDIT", parentRevisionId: "rev-2", content: "Edited again." },
      "rev-2": { id: "rev-2", changeOrigin: "MANUAL_EDIT", parentRevisionId: "rev-1", content: "Edited." },
    },
    section,
    draft,
    period,
    extracted: [{ scope: "SECTION_TYPE", scopeId: "x", category: "TONE", statement: "Should never be reached." }],
  });
  const result = await handler.handle({ tenantId, sectionId: "sec-1", revisionId: "rev-3" });
  assert.ok(result.ok);
  assert.equal(result.value.proposed, 0);
  assert.equal(proposedCalls.length, 0);
});

test("a non-MANUAL_EDIT revision is a no-op", async () => {
  const { handler, proposedCalls } = makeHandler({
    revisionsById: {
      "rev-1": { id: "rev-1", changeOrigin: "GENERATION", content: "x" },
    },
    section,
    draft,
    period,
  });
  const result = await handler.handle({ tenantId, sectionId: "sec-1", revisionId: "rev-1" });
  assert.ok(result.ok);
  assert.equal(result.value.proposed, 0);
  assert.equal(proposedCalls.length, 0);
});

test("an extractor that finds no candidates proposes nothing", async () => {
  const { handler, proposedCalls } = makeHandler({
    revisionsById: {
      "rev-2": { id: "rev-2", changeOrigin: "MANUAL_EDIT", parentRevisionId: "rev-1", content: "Edited." },
      "rev-1": { id: "rev-1", changeOrigin: "GENERATION", content: "Original." },
    },
    section,
    draft,
    period,
    extracted: [],
  });
  const result = await handler.handle({ tenantId, sectionId: "sec-1", revisionId: "rev-2" });
  assert.ok(result.ok);
  assert.equal(result.value.proposed, 0);
  assert.equal(proposedCalls.length, 0);
});
