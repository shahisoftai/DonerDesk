import test from "node:test";
import assert from "node:assert/strict";
import { ReviewEvidenceHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId: { toString: () => "t" }, userId: "rev" } };

function setup(status = "PENDING_REVIEW", used = null) {
  const file = {
    id: "e1", projectId: "p", verificationStatus: status, reviewNote: undefined,
    applyReview(to, note) { this.verificationStatus = to; this.reviewNote = note?.trim() || undefined; },
  };
  const audits = [];
  const handler = new ReviewEvidenceHandler(
    { findById: async (id) => ok(id === "e1" ? file : null), update: async () => ok(file) },
    { record: async (e) => audits.push(e) },
    { reportUsing: async () => ok(used) },
  );
  return { handler, file, audits };
}

test("a correction request needs a reason, is stored with it, and is audited", async () => {
  const { handler, file, audits } = setup();
  assert.equal((await handler.handle(ctx, "e1", { action: "REQUEST_CORRECTION" })).ok, false);
  const r = await handler.handle(ctx, "e1", { action: "REQUEST_CORRECTION", note: "  Page 2 is cut off " });
  assert.equal(r.ok, true);
  assert.equal(file.verificationStatus, "NEEDS_CORRECTION");
  assert.equal(file.reviewNote, "Page 2 is cut off");
  assert.equal(audits[0].eventType, "evidence.request_correction");
});

test("verifying clears the reason", async () => {
  const { handler, file } = setup("NEEDS_CORRECTION");
  file.reviewNote = "old reason";
  assert.equal((await handler.handle(ctx, "e1", { action: "VERIFY" })).ok, true);
  assert.equal(file.verificationStatus, "VERIFIED");
  assert.equal(file.reviewNote, undefined);
});

test("a file an approved report relies on cannot be rejected or archived, and the refusal names the report", async () => {
  const { handler, file } = setup("VERIFIED", { reportTitle: "Q1 report" });
  const r = await handler.handle(ctx, "e1", { action: "REJECT", note: "wrong copy" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /Q1 report/);
  assert.equal((await handler.handle(ctx, "e1", { action: "ARCHIVE" })).ok, false);
  assert.equal(file.verificationStatus, "VERIFIED");
  // asking for a correction is still allowed: it does not take the file out of use
  assert.equal((await handler.handle(ctx, "e1", { action: "REQUEST_CORRECTION", note: "blurry" })).ok, true);
});

test("a rejected file can be brought back, an unknown file is not found", async () => {
  const { handler, file } = setup("REJECTED");
  assert.equal((await handler.handle(ctx, "e1", { action: "RESTORE" })).ok, true);
  assert.equal(file.verificationStatus, "PENDING_REVIEW");
  assert.equal((await handler.handle(ctx, "nope", { action: "VERIFY" })).ok, false);
});
