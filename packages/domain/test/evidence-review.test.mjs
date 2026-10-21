import test from "node:test";
import assert from "node:assert/strict";
import { checkEvidenceReview, statusAfterRepoint, EVIDENCE_REVIEW_RULES } from "../dist/index.js";

test("verify moves an open file to VERIFIED, and not a rejected one", () => {
  assert.deepEqual(checkEvidenceReview("PENDING_REVIEW", "VERIFY", undefined), { ok: true, to: "VERIFIED", checkReportUse: false });
  assert.equal(checkEvidenceReview("REJECTED", "VERIFY", undefined).ok, false);
  assert.equal(checkEvidenceReview("ARCHIVED", "VERIFY", undefined).ok, false);
});

test("a correction request and a rejection need a reason", () => {
  assert.equal(checkEvidenceReview("PENDING_REVIEW", "REQUEST_CORRECTION", "  ").ok, false);
  assert.equal(checkEvidenceReview("PENDING_REVIEW", "REJECT", undefined).ok, false);
  assert.deepEqual(checkEvidenceReview("VERIFIED", "REQUEST_CORRECTION", "Page 2 is cut off"), { ok: true, to: "NEEDS_CORRECTION", checkReportUse: false });
});

test("taking a file out of use is checked against the reports; archiving needs no reason", () => {
  assert.equal(checkEvidenceReview("VERIFIED", "REJECT", "Not the signed copy").checkReportUse, true);
  assert.deepEqual(checkEvidenceReview("VERIFIED", "ARCHIVE", undefined), { ok: true, to: "ARCHIVED", checkReportUse: true });
});

test("a rejected or archived file can be brought back for another look", () => {
  assert.deepEqual(checkEvidenceReview("REJECTED", "RESTORE", undefined), { ok: true, to: "PENDING_REVIEW", checkReportUse: false });
  assert.equal(checkEvidenceReview("VERIFIED", "RESTORE", undefined).ok, false);
});

test("every action has a rule, and the refusal names the state", () => {
  assert.deepEqual(Object.keys(EVIDENCE_REVIEW_RULES).sort(), ["ARCHIVE", "REJECT", "REQUEST_CORRECTION", "RESTORE", "VERIFY"]);
  assert.match(checkEvidenceReview("ARCHIVED", "REJECT", "x").reason, /archived/);
});

test("re-pointing a verified file sends it back for review; other states are left", () => {
  assert.equal(statusAfterRepoint("VERIFIED"), "PENDING_REVIEW");
  assert.equal(statusAfterRepoint("NEEDS_CORRECTION"), "NEEDS_CORRECTION");
});
