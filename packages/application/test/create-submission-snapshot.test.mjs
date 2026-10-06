import assert from "node:assert/strict";
import test from "node:test";
import { CreateSubmissionSnapshotHandler } from "../dist/index.js";

/** Contract for sealing the donor copy (25.3): it resolves requirements itself, and refuses in plain words. */

const tenantId = { toString: () => "t1" };
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function build({ stored, resolverResult, gate = { submitBlocked: false, submitNeedsDecision: false, approvalBlocked: false, blockReasons: [] }, resolver = true } = {}) {
  const created = [];
  const audits = [];
  const published = [];
  const resolverCalls = [];
  const handler = new CreateSubmissionSnapshotHandler(
    { generate: () => "snap-1" },
    { findById: async () => ok({ id: "d1", reportingPeriodId: "p1", projectId: "pr1" }) },
    { findByReportDraft: async () => ok([{ id: "s1", sectionTitle: "Results", currentRevisionId: "rev1", status: "APPROVED" }]) },
    { findByDraft: async () => ok([]) },
    { findById: async () => ok({ id: "rev1", revisionNumber: 1, assuranceState: "CURRENT", contentHash: "h1" }) },
    { findLatestForPeriod: async () => ok(stored ?? null) },
    { create: async (s) => { created.push(s); return ok(s); } },
    { findById: async () => ok({ donorTemplateVersion: undefined }) },
    { findByDraft: async () => ok([]) },
    { evaluateGate: async () => ok(gate) },
    { record: async (e) => { audits.push(e); } },
    { publish: async (e) => { published.push(...e); } },
    resolver ? { resolve: async (i) => { resolverCalls.push(i); return resolverResult ?? ok({ id: "req-1", snapshot: [], coverage: { satisfied: [], unmet: [] } }); } } : undefined,
  );
  return { handler, created, audits, published, resolverCalls };
}

const goodRequirements = { id: "req-0", snapshot: [{ key: "exec", kind: "SECTION" }], coverage: { satisfied: ["exec"], unmet: [] } };

test("seals with stored requirements and does not resolve again", async () => {
  const t = build({ stored: goodRequirements });
  const r = await t.handler.handle(ctx, "d1");
  assert.equal(r.ok, true);
  assert.equal(t.created.length, 1);
  assert.equal(t.resolverCalls.length, 0);
  assert.equal(t.audits[0].eventType, "report.submission.snapshot.created");
  assert.equal(t.published.length, 1);
});

test("with no stored requirements it resolves them itself, so a template-based period still seals", async () => {
  const t = build({ stored: null });
  const r = await t.handler.handle(ctx, "d1");
  assert.equal(r.ok, true);
  assert.equal(t.resolverCalls.length, 1);
  assert.equal(t.resolverCalls[0].reportingPeriodId, "p1");
  assert.equal(t.created[0].requirementSnapshotId, "req-1");
});

test("a failing resolver is reported, nothing is sealed", async () => {
  const t = build({ stored: null, resolverResult: { ok: false, error: new Error("boom") } });
  const r = await t.handler.handle(ctx, "d1");
  assert.equal(r.ok, false);
  assert.equal(t.created.length, 0);
});

test("without any resolver the refusal says what to do, in words", async () => {
  const r = await build({ stored: null, resolver: false }).handler.handle(ctx, "d1");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /could not be worked out/);
  assert.doesNotMatch(r.error.message, /snapshot|aggregate gate/i);
});

test("a blocked gate lists the reasons it gave", async () => {
  const t = build({ stored: goodRequirements, gate: { submitBlocked: true, submitNeedsDecision: false, approvalBlocked: false, blockReasons: ["2 statements still need a decision", "Section Results is not approved"] } });
  const r = await t.handler.handle(ctx, "d1");
  assert.equal(r.ok, false);
  assert.equal(r.error.message, "The donor copy cannot be sealed yet: 2 statements still need a decision; Section Results is not approved.");
  assert.equal(t.created.length, 0);
});

test("unmet requirements are named as a person would say them", async () => {
  const t = build({ stored: { ...goodRequirements, coverage: { satisfied: [], unmet: ["annex_a_budget", "bp:monthly:exec"] } } });
  const r = await t.handler.handle(ctx, "d1");
  assert.equal(r.ok, false);
  assert.equal(r.error.message, "The report does not yet cover everything the donor requires: Annex a budget; Monthly exec.");
});
