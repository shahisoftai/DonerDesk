/**
 * Structured verification reasons. Gate decisions and approval/submission
 * logic must consume these enums, never infer meaning from human-readable
 * detail strings. Human-readable detail is presentation only.
 */
export type VerificationReasonCode =
  | "SOURCE_MISSING"
  | "SOURCE_NOT_FOUND"
  | "CHUNK_NOT_FOUND"
  | "SOURCE_TEXT_MISMATCH"
  | "EVIDENCE_HASH_MISMATCH"
  | "EVIDENCE_UNVERIFIED"
  | "CONFIDENTIALITY_RESTRICTED"
  | "VALUE_MISMATCH"
  | "UNIT_MISMATCH"
  | "PERIOD_MISMATCH"
  | "ENTITY_MISMATCH"
  | "DERIVATION_INVALID"
  | "ENTAILMENT_FAILED"
  | "ENTAILMENT_UNCERTAIN"
  | "CAUSAL_REVIEW_REQUIRED"
  | "COVERAGE_GAP"
  | "REQUIREMENT_UNSATISFIED";

export const VERIFICATION_REASON_CODES: VerificationReasonCode[] = [
  "SOURCE_MISSING",
  "SOURCE_NOT_FOUND",
  "CHUNK_NOT_FOUND",
  "SOURCE_TEXT_MISMATCH",
  "EVIDENCE_HASH_MISMATCH",
  "EVIDENCE_UNVERIFIED",
  "CONFIDENTIALITY_RESTRICTED",
  "VALUE_MISMATCH",
  "UNIT_MISMATCH",
  "PERIOD_MISMATCH",
  "ENTITY_MISMATCH",
  "DERIVATION_INVALID",
  "ENTAILMENT_FAILED",
  "ENTAILMENT_UNCERTAIN",
  "CAUSAL_REVIEW_REQUIRED",
  "COVERAGE_GAP",
  "REQUIREMENT_UNSATISFIED",
];

/**
 * Whether a reason code represents a deterministic failure (safe to surface as
 * a blocking verification result) or an uncertain state requiring review.
 */
export type ReasonClass = "DETERMINISTIC_FAILURE" | "UNCERTAIN" | "INTEGRITY" | "POLICY";

export const REASON_CLASSES: Record<VerificationReasonCode, ReasonClass> = {
  SOURCE_MISSING: "DETERMINISTIC_FAILURE",
  SOURCE_NOT_FOUND: "INTEGRITY",
  CHUNK_NOT_FOUND: "INTEGRITY",
  SOURCE_TEXT_MISMATCH: "INTEGRITY",
  EVIDENCE_HASH_MISMATCH: "INTEGRITY",
  EVIDENCE_UNVERIFIED: "DETERMINISTIC_FAILURE",
  CONFIDENTIALITY_RESTRICTED: "POLICY",
  VALUE_MISMATCH: "DETERMINISTIC_FAILURE",
  UNIT_MISMATCH: "DETERMINISTIC_FAILURE",
  PERIOD_MISMATCH: "DETERMINISTIC_FAILURE",
  ENTITY_MISMATCH: "DETERMINISTIC_FAILURE",
  DERIVATION_INVALID: "DETERMINISTIC_FAILURE",
  ENTAILMENT_FAILED: "DETERMINISTIC_FAILURE",
  ENTAILMENT_UNCERTAIN: "UNCERTAIN",
  CAUSAL_REVIEW_REQUIRED: "UNCERTAIN",
  COVERAGE_GAP: "DETERMINISTIC_FAILURE",
  REQUIREMENT_UNSATISFIED: "DETERMINISTIC_FAILURE",
};

export function isVerificationReasonCode(value: string): value is VerificationReasonCode {
  return (VERIFICATION_REASON_CODES as readonly string[]).includes(value);
}

/**
 * What each reason means in plain words. One table for every place a reason is shown (the report editor, the
 * checklist), so a raw code never reaches a user and two screens never explain the same reason differently.
 */
export const VERIFICATION_REASON_PLAIN: Record<VerificationReasonCode, string> = {
  SOURCE_MISSING: "no source was given",
  SOURCE_NOT_FOUND: "the source could not be found",
  CHUNK_NOT_FOUND: "the quoted passage could not be found in the source",
  SOURCE_TEXT_MISMATCH: "the source says something different",
  EVIDENCE_HASH_MISMATCH: "the evidence file changed after it was checked",
  EVIDENCE_UNVERIFIED: "the evidence has not been verified yet",
  CONFIDENTIALITY_RESTRICTED: "the evidence is confidential",
  VALUE_MISMATCH: "the number does not match the evidence",
  UNIT_MISMATCH: "the unit does not match the evidence",
  PERIOD_MISMATCH: "the figure is from a different period",
  ENTITY_MISMATCH: "the figure refers to something else in the evidence",
  DERIVATION_INVALID: "the calculation does not add up",
  ENTAILMENT_FAILED: "the evidence does not support this statement",
  ENTAILMENT_UNCERTAIN: "the evidence only partly supports this statement",
  CAUSAL_REVIEW_REQUIRED: "it claims a cause and effect that needs a human check",
  COVERAGE_GAP: "no evidence covers this statement",
  REQUIREMENT_UNSATISFIED: "a donor requirement is not met",
};

/** Plain-language reason for a code; anything unknown (or no code yet) reads as "not checked", never as a raw value. */
export function plainVerificationReason(code: string | undefined | null): string {
  if (!code) return "it has not been checked against the evidence yet";
  return isVerificationReasonCode(code) ? VERIFICATION_REASON_PLAIN[code] : "it could not be checked against the evidence";
}
