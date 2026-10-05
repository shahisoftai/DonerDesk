import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fallbackReasonCopy,
  draftGeneratedCopy,
  verificationResultCopy,
  verificationDetailCopy,
  verificationReasonCopy,
  evidenceLabelCopy,
} from "../../src/lib/reporting-copy.ts";

const FALLBACK_REASONS = [
  "AI_REPORTER_DISABLED",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_EMPTY_RESPONSE",
  "PROVIDER_MALFORMED_RESPONSE",
  "PROVIDER_HTTP_ERROR",
  "PII_REJECTED",
  "VALIDATOR_FAILED",
  "SOMETHING_NEW",
  undefined,
];

// Nothing an NGO user sees may leak internal codes, env names or hosts.
const JARGON = /[A-Z]{2,}_[A-Z]|AI_REPORTER|INTERNAL_TOKEN|\bapi host\b|\bstub\b|\bworker\b/;

test("fallback copy is plain language for every known and unknown reason", () => {
  for (const reason of FALLBACK_REASONS) {
    const text = fallbackReasonCopy(reason);
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, JARGON, `jargon in copy for ${String(reason)}`);
  }
});

test("draft generated copy includes count and fallback explanation only when used", () => {
  assert.equal(draftGeneratedCopy({ sectionCount: 1, fallbackUsed: false }), "Draft created with 1 section.");
  const withFallback = draftGeneratedCopy({ sectionCount: 7, fallbackUsed: true, fallbackReason: "PROVIDER_TIMEOUT" });
  assert.match(withFallback, /^Draft created with 7 sections\. /);
  assert.match(withFallback, /took too long/);
});

test("verification results map to labels, unknown results never echo the enum", () => {
  assert.equal(verificationResultCopy("PASSED"), "Matches evidence");
  assert.equal(verificationResultCopy("FAILED"), "Not supported by evidence");
  assert.equal(verificationResultCopy("ACCEPTED_WITH_LIMITATION"), "Kept with a note");
  assert.equal(verificationResultCopy("EXCLUDED"), "Left out of the report");
  assert.doesNotMatch(verificationResultCopy("WEIRD_STATE"), JARGON);
});

test("numeric verifier detail becomes an actionable sentence", () => {
  const text = verificationDetailCopy("Numeric assertion failed: VALUE_MISMATCH, UNIT_MISMATCH.");
  assert.equal(text, "This figure could not be confirmed: the number does not match the evidence; the unit does not match the evidence.");
});

test("detail copy never leaves UPPER_SNAKE codes behind", () => {
  const samples = [
    "Numeric assertion failed: PERIOD_MISMATCH. Expected cumulative value.",
    "Numeric assertion matches verified finding OUT-1",
    "Entailment check returned ENTAILMENT_UNCERTAIN for chunk",
    "Blocked by SOME_UNKNOWN_CODE",
    "",
  ];
  for (const sample of samples) assert.doesNotMatch(verificationDetailCopy(sample), /[A-Z]{2,}_[A-Z]/, sample);
  assert.equal(verificationDetailCopy("Numeric assertion matches verified finding OUT-1"), "This figure matches the verified indicator data.");
  assert.equal(
    verificationDetailCopy("Entailment check ENTAILMENT_FAILED"),
    "This statement could not be confirmed: the evidence does not support this statement.",
  );
  assert.equal(verificationDetailCopy(undefined), "");
});

test("reason copy has a fallback", () => {
  assert.equal(verificationReasonCopy("VALUE_MISMATCH"), "the number does not match the evidence");
  assert.doesNotMatch(verificationReasonCopy("NOT_A_CODE"), JARGON);
});

test("evidence label uses the source reference title, never the id", () => {
  const refs = [{ type: "evidence", id: "ev-123456789", label: "Q3 distribution log.xlsx" }];
  assert.equal(evidenceLabelCopy("ev-123456789", refs), "Q3 distribution log.xlsx");
  assert.equal(evidenceLabelCopy("ev-other", refs), "Evidence file");
  assert.equal(evidenceLabelCopy("ev-123456789", undefined), "Evidence file");
});

import { flagClassCopy } from "../../src/lib/reporting-copy.ts";

const ALL_REASON_CODES = [
  "SOURCE_MISSING", "SOURCE_NOT_FOUND", "CHUNK_NOT_FOUND", "SOURCE_TEXT_MISMATCH", "EVIDENCE_HASH_MISMATCH", "EVIDENCE_UNVERIFIED",
  "CONFIDENTIALITY_RESTRICTED", "VALUE_MISMATCH", "UNIT_MISMATCH", "PERIOD_MISMATCH", "ENTITY_MISMATCH", "DERIVATION_INVALID",
  "ENTAILMENT_FAILED", "ENTAILMENT_UNCERTAIN", "CAUSAL_REVIEW_REQUIRED", "COVERAGE_GAP", "REQUIREMENT_UNSATISFIED",
];

test("every verification reason code has its own plain-language phrase (a new code without copy fails here)", () => {
  const generic = verificationReasonCopy("NOT_A_REAL_CODE");
  for (const code of ALL_REASON_CODES) {
    const phrase = verificationReasonCopy(code);
    assert.notEqual(phrase, generic, `${code} has no copy`);
    assert.doesNotMatch(phrase, /[A-Z]{2,}_[A-Z]/);
  }
});

test("flag class copy is plain and unknown classes fail safe to a decision", () => {
  for (const c of ["REPORT_ERROR", "NEEDS_DECISION", "UNCONFIRMED", undefined, "WHATEVER"]) {
    const copy = flagClassCopy(c);
    assert.ok(copy.title && copy.hint);
    assert.doesNotMatch(copy.title + copy.hint, /[A-Z]{2,}_[A-Z]/);
  }
  assert.equal(flagClassCopy("WHATEVER").title, "Needs your decision");
  assert.equal(flagClassCopy("UNCONFIRMED").title, "We could not confirm");
});
