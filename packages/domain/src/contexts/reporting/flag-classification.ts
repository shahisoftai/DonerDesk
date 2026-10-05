import { REASON_CLASSES, isVerificationReasonCode, type VerificationReasonCode } from "./verification-reason.js";

/**
 * Presentation-only split of a flagged statement into "your report is wrong"
 * and "our checker could not confirm it". It never changes a claim's
 * verification result, the gate or approval rules (`evaluateReportGate` stays
 * the only gate authority); it only decides how the flag is shown and which
 * flags a reviewer may accept in bulk. It reads structured fields only, never
 * the free-text detail. Unknown or missing codes fall to NEEDS_DECISION, the
 * conservative class, so a new reason can never be hidden as a checker limit.
 */
export type FlagClass = "REPORT_ERROR" | "NEEDS_DECISION" | "UNCONFIRMED";

export interface FlaggedClaimFacts {
  verificationReasonCode?: string | null;
  assertionType?: string | null;
  type?: string | null;
  materiality?: string | null;
  hasNumericAtoms?: boolean;
}

interface FlagRule {
  name: string;
  matches(code: VerificationReasonCode | undefined, facts: FlaggedClaimFacts): boolean;
  result: FlagClass;
}

/** The figure itself disagrees with the evidence or the data. */
const FIGURE_REASONS: ReadonlySet<VerificationReasonCode> = new Set(["VALUE_MISMATCH", "UNIT_MISMATCH", "PERIOD_MISMATCH", "ENTITY_MISMATCH", "DERIVATION_INVALID"]);

const isFigureClaim = (f: FlaggedClaimFacts) =>
  f.assertionType === "NUMERIC" || f.assertionType === "COMPLIANCE_DECLARATION" || f.type === "NUMERIC" || f.hasNumericAtoms === true;

/** First match wins. Extend by adding a rule, never by branching in the classifier. */
export const FLAG_CLASS_RULES: ReadonlyArray<FlagRule> = [
  { name: "figure-mismatch", matches: (c) => c !== undefined && FIGURE_REASONS.has(c), result: "REPORT_ERROR" },
  { name: "integrity-or-policy", matches: (c) => c !== undefined && (REASON_CLASSES[c] === "INTEGRITY" || REASON_CLASSES[c] === "POLICY"), result: "NEEDS_DECISION" },
  { name: "uncertain", matches: (c) => c !== undefined && REASON_CLASSES[c] === "UNCERTAIN", result: "UNCONFIRMED" },
  { name: "material-figure-failure", matches: (c, f) => c !== undefined && f.materiality !== "NOT_MATERIAL" && isFigureClaim(f), result: "REPORT_ERROR" },
  { name: "non-figure-or-immaterial-failure", matches: (c) => c !== undefined, result: "UNCONFIRMED" },
];

export function classifyFlag(facts: FlaggedClaimFacts): { class: FlagClass; rule: string } {
  const code = facts.verificationReasonCode && isVerificationReasonCode(facts.verificationReasonCode) ? facts.verificationReasonCode : undefined;
  for (const rule of FLAG_CLASS_RULES) {
    if (rule.matches(code, facts)) return { class: rule.result, rule: rule.name };
  }
  return { class: "NEEDS_DECISION", rule: "fallback" };
}

/**
 * Only "could not confirm" flags may be accepted together under one explained decision (the
 * note is mandatory and audited). Figure errors and integrity/policy decisions always need
 * a person's eye on that statement.
 */
export function isBulkAcceptable(flag: FlagClass): boolean {
  return flag === "UNCONFIRMED";
}
