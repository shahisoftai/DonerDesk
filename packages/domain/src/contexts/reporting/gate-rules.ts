/**
 * Gate policy for report approval and submission, expressed as pure
 * functions. This is the single source of truth for the §2.4 policy table:
 * verified and descriptive results continue; unsupported material claims warn
 * and block submission unless accepted with a limitation; numeric
 * contradictions and confidentiality violations block; subjective concerns
 * defer to a human; missing optional evidence only warns.
 */
export type GateKind =
  | "VERIFIED"
  | "DESCRIPTIVE"
  | "AUTO_FIXABLE"
  | "UNSUPPORTED_MATERIAL_CLAIM"
  | "NUMERIC_CONTRADICTION"
  | "CONFIDENTIALITY_VIOLATION"
  | "SUBJECTIVE_CONCERN"
  | "MISSING_OPTIONAL_EVIDENCE";

export const GATE_KINDS: GateKind[] = [
  "VERIFIED",
  "DESCRIPTIVE",
  "AUTO_FIXABLE",
  "UNSUPPORTED_MATERIAL_CLAIM",
  "NUMERIC_CONTRADICTION",
  "CONFIDENTIALITY_VIOLATION",
  "SUBJECTIVE_CONCERN",
  "MISSING_OPTIONAL_EVIDENCE",
];

export type GateDrafting = "CONTINUE" | "FIX_SILENTLY" | "CONTINUE_INTERNALLY";
export type GateApproval = "ALLOW" | "WARN" | "BLOCK";
export type GateSubmit = "ALLOW" | "WARN" | "BLOCK" | "BLOCK_OR_EXCLUDE" | "HUMAN_DECISION";

export interface GateDecision {
  kind: GateKind;
  drafting: GateDrafting;
  approval: GateApproval;
  submit: GateSubmit;
  reason: string;
}

const GATE_TABLE: Record<GateKind, { drafting: GateDrafting; approval: GateApproval; submit: GateSubmit; reason: string }> = {
  VERIFIED: { drafting: "CONTINUE", approval: "ALLOW", submit: "ALLOW", reason: "Finding passed independent verification" },
  DESCRIPTIVE: { drafting: "CONTINUE", approval: "ALLOW", submit: "ALLOW", reason: "Descriptive neutral finding from unresolved or neutral semantics" },
  AUTO_FIXABLE: { drafting: "FIX_SILENTLY", approval: "ALLOW", submit: "ALLOW", reason: "Auto-fixable problem corrected before approval" },
  UNSUPPORTED_MATERIAL_CLAIM: { drafting: "CONTINUE", approval: "WARN", submit: "BLOCK_OR_EXCLUDE", reason: "Unsupported material claim requires an authorized limitation or exclusion" },
  NUMERIC_CONTRADICTION: { drafting: "CONTINUE", approval: "BLOCK", submit: "BLOCK_OR_EXCLUDE", reason: "Numeric contradiction between claim and verified finding" },
  CONFIDENTIALITY_VIOLATION: { drafting: "CONTINUE_INTERNALLY", approval: "BLOCK", submit: "BLOCK", reason: "Confidential source included without authorization" },
  SUBJECTIVE_CONCERN: { drafting: "CONTINUE", approval: "ALLOW", submit: "HUMAN_DECISION", reason: "Subjective concern deferred to human decision" },
  MISSING_OPTIONAL_EVIDENCE: { drafting: "CONTINUE", approval: "ALLOW", submit: "WARN", reason: "Optional evidence missing; warning only" },
};

export function gateDecisionFor(kind: GateKind): GateDecision {
  const row = GATE_TABLE[kind];
  return { kind, drafting: row.drafting, approval: row.approval, submit: row.submit, reason: row.reason };
}

export interface ReportGateInput {
  claimOutcomes: Array<{ kind: GateKind; detail: string }>;
  unresolvedSemantics: number;
}

export interface ReportGateResult {
  decisions: GateDecision[];
  /** Internal approval must be blocked (any BLOCK at approval). */
  approvalBlocked: boolean;
  /** Donor submission is blocked outright (confidentiality, or contradictions without an exclusion path). */
  submitBlocked: boolean;
  /** Submission allowed only after an authorized limitation/exclusion decision. */
  submitNeedsDecision: boolean;
  warnCount: number;
  blockReasons: string[];
}

/**
 * Evaluates the aggregate gate for a draft. `unresolvedSemantics` is derived
 * from indicators whose semantics are REQUIRES_REVIEW and are quoted
 * evaluatively; those always produce descriptive-only narrative, so any
 * attempt to attach evaluative wording is blocked here.
 */
export function evaluateReportGate(input: ReportGateInput): ReportGateResult {
  const decisions: GateDecision[] = [];
  const seen = new Set<GateKind>();
  for (const outcome of input.claimOutcomes) {
    if (!GATE_KINDS.includes(outcome.kind)) throw new Error(`Unknown gate kind: ${outcome.kind}`);
    const decision = gateDecisionFor(outcome.kind);
    decisions.push(decision);
    seen.add(outcome.kind);
  }
  if (input.unresolvedSemantics > 0) {
    decisions.push({
      kind: "NUMERIC_CONTRADICTION",
      drafting: "CONTINUE",
      approval: "BLOCK",
      submit: "BLOCK_OR_EXCLUDE",
      reason: `${input.unresolvedSemantics} indicator(s) have unresolved semantics; evaluative statements are blocked`,
    });
  }

  const approvalBlocked = decisions.some((d) => d.approval === "BLOCK");
  const submitBlocked = decisions.some((d) => d.submit === "BLOCK");
  const submitNeedsDecision = decisions.some((d) => d.submit === "BLOCK_OR_EXCLUDE" || d.submit === "HUMAN_DECISION");
  const warnCount = decisions.filter((d) => d.approval === "WARN" || d.submit === "WARN").length;
  const blockReasons = decisions.filter((d) => d.approval === "BLOCK" || d.submit === "BLOCK" || d.submit === "BLOCK_OR_EXCLUDE").map((d) => d.reason);

  return {
    decisions,
    approvalBlocked,
    submitBlocked,
    submitNeedsDecision,
    warnCount,
    blockReasons,
  };
}
