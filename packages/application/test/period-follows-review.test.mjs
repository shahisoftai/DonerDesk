import assert from "node:assert/strict";
import test from "node:test";
import { SubmitReportForReviewHandler, RejectReportHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: "t1", userId: "author" }, requestId: "r" };
function fixture(initial) {
  const state = { status: initial, updates: 0 };
  const period = {
    advanceStatus(v) { if (state.status === "DRAFT_GENERATED" && v === "UNDER_REVIEW") state.status = v; },
    returnToDraftStatus() { if (state.status === "UNDER_REVIEW") state.status = "DRAFT_GENERATED"; },
  };
  const draft = { reportingPeriodId: "p1", projectId: "pr", requestReview() {}, reject() {} };
  const drafts = { findById: async () => ({ ok: true, value: draft }), update: async () => ({ ok: true, value: draft }) };
  const periods = { findById: async () => ({ ok: true, value: period }), update: async () => { state.updates += 1; return { ok: true, value: period }; } };
  const audit = { record: async () => {} };
  return { state, drafts, periods, audit };
}

test("submitting a report for review moves its period to under review", async () => {
  const f = fixture("DRAFT_GENERATED");
  const r = await new SubmitReportForReviewHandler(f.drafts, f.audit, undefined, f.periods).handle(ctx, "d1");
  assert.equal(r.ok, true);
  assert.equal(f.state.status, "UNDER_REVIEW");
  assert.equal(f.state.updates, 1);
});

test("returning a report takes its period back to draft generated", async () => {
  const f = fixture("UNDER_REVIEW");
  const r = await new RejectReportHandler(f.drafts, f.audit, undefined, f.periods).handle(ctx, "d1", "fix section 2");
  assert.equal(r.ok, true);
  assert.equal(f.state.status, "DRAFT_GENERATED");
});

test("without a period repository both handlers work as before", async () => {
  const f = fixture("DRAFT_GENERATED");
  assert.equal((await new SubmitReportForReviewHandler(f.drafts, f.audit).handle(ctx, "d1")).ok, true);
  assert.equal((await new RejectReportHandler(f.drafts, f.audit).handle(ctx, "d1")).ok, true);
  assert.equal(f.state.updates, 0);
});
