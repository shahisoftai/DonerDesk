import test from "node:test";
import assert from "node:assert/strict";
import { classifyFlag, isBulkAcceptable, VERIFICATION_REASON_CODES, REASON_CLASSES } from "../dist/index.js";

const cls = (f) => classifyFlag(f).class;

test("every reason code × materiality × figure/non-figure is classified (exhaustive)", () => {
  for (const code of VERIFICATION_REASON_CODES) {
    for (const materiality of ["MATERIAL", "NOT_MATERIAL", undefined]) {
      for (const type of ["NUMERIC", "QUALITATIVE"]) {
        const r = classifyFlag({ verificationReasonCode: code, materiality, type });
        assert.ok(["REPORT_ERROR", "NEEDS_DECISION", "UNCONFIRMED"].includes(r.class), `${code}`);
        assert.notEqual(r.rule, "fallback", `${code}/${materiality}/${type} fell through`);
      }
    }
  }
});

test("figure mismatches are always report errors, regardless of materiality", () => {
  for (const code of ["VALUE_MISMATCH", "UNIT_MISMATCH", "PERIOD_MISMATCH", "ENTITY_MISMATCH", "DERIVATION_INVALID"]) {
    assert.equal(cls({ verificationReasonCode: code, materiality: "NOT_MATERIAL", type: "QUALITATIVE" }), "REPORT_ERROR");
  }
});

test("integrity and policy reasons need a decision", () => {
  for (const code of ["EVIDENCE_HASH_MISMATCH", "CONFIDENTIALITY_RESTRICTED", "SOURCE_NOT_FOUND"]) {
    assert.equal(cls({ verificationReasonCode: code, type: "FACTUAL" }), "NEEDS_DECISION");
  }
});

test("interpretive statements the checker could not confirm are UNCONFIRMED", () => {
  assert.equal(cls({ verificationReasonCode: "ENTAILMENT_UNCERTAIN", type: "QUALITATIVE" }), "UNCONFIRMED");
  assert.equal(cls({ verificationReasonCode: "COVERAGE_GAP", type: "QUALITATIVE", materiality: "NOT_MATERIAL" }), "UNCONFIRMED");
  assert.equal(cls({ verificationReasonCode: "SOURCE_MISSING", type: "FACTUAL" }), "UNCONFIRMED");
});

test("a material figure with no support is a report error", () => {
  assert.equal(cls({ verificationReasonCode: "SOURCE_MISSING", type: "NUMERIC", materiality: "MATERIAL" }), "REPORT_ERROR");
  assert.equal(cls({ verificationReasonCode: "COVERAGE_GAP", hasNumericAtoms: true }), "REPORT_ERROR");
});

test("unknown or missing codes fail safe to NEEDS_DECISION", () => {
  assert.equal(cls({ verificationReasonCode: "SOMETHING_NEW" }), "NEEDS_DECISION");
  assert.equal(cls({}), "NEEDS_DECISION");
});

test("only UNCONFIRMED flags are bulk-acceptable", () => {
  assert.equal(isBulkAcceptable("UNCONFIRMED"), true);
  assert.equal(isBulkAcceptable("REPORT_ERROR"), false);
  assert.equal(isBulkAcceptable("NEEDS_DECISION"), false);
});

test("classification never mutates its input", () => {
  const facts = Object.freeze({ verificationReasonCode: "VALUE_MISMATCH", type: "NUMERIC" });
  assert.doesNotThrow(() => classifyFlag(facts));
  assert.ok(REASON_CLASSES);
});
