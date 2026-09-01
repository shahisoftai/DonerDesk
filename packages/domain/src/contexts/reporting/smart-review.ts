import type { GateIssue, GateKind } from "./gate-rules.js";

/**
 * Smart Review — a presentation/grouping layer over the existing gate output.
 *
 * It consumes `evaluateReportGate`'s `blockingIssues` (the single source of
 * truth) and produces UI-ready, plain-language issues. It never re-verifies,
 * never re-extracts claims, and never introduces a second compliance system.
 * The underlying assurance engine stays authoritative: the action the user
 * takes must ultimately mutate the same claim/gate state so P0-1 reconciliation
 * remains in effect.
 *
 * Nothing internal is surfaced: no reason codes, no assertion IDs, no
 * verification-strategy names, no assurance states, no raw terminology.
 */

export type SmartReviewSeverity = "BLOCKING" | "WARNING";

export type SmartReviewActionType =
  | "fix-number"
  | "add-evidence"
  | "complete-section"
  | "review-claim"
  | "review-section"
  | "reverify"
  | "review-confidentiality"
  | "review-evidence";

export interface SmartReviewIssue {
  /** Stable id for list keys; the real navigation uses claimId/sectionId/evidenceId. */
  id: string;
  severity: SmartReviewSeverity;
  /** Plain-language headline (what the user should understand at a glance). */
  title: string;
  /** Plain-language explanation of which statement/section is affected. */
  explanation: string;
  claimId?: string;
  sectionId?: string;
  evidenceId?: string;
  action: { type: SmartReviewActionType; label: string };
  /** Whether this issue blocks approval (not merely submission). */
  blocksApproval: boolean;
}

export interface SmartReviewSummary {
  issueCount: number;
  blockingCount: number;
  items: SmartReviewIssue[];
}

export interface SmartReviewInput {
  blockingIssues: GateIssue[];
  /** Clean statement text keyed by claim id (avoids leaking technical detail). */
  claimTextById?: Map<string, string>;
  /** Section title keyed by section id. */
  sectionTitleById?: Map<string, string>;
}

interface KindRule {
  title: string;
  action: { type: SmartReviewActionType; label: string };
  blocksApproval: boolean;
  priority: number;
  fallback: string;
}

const KIND_RULES: Record<GateKind, KindRule> = {
  NUMERIC_CONTRADICTION: {
    title: "A reported figure doesn't match your approved data",
    action: { type: "fix-number", label: "Review and fix" },
    blocksApproval: true,
    priority: 1,
    fallback: "A number in the report conflicts with the approved project data.",
  },
  REQUIREMENT_UNSATISFIED: {
    title: "A donor requirement is incomplete",
    action: { type: "complete-section", label: "Complete this section" },
    blocksApproval: false,
    priority: 2,
    fallback: "A required donor item in the report template has not been fully answered.",
  },
  UNSUPPORTED_MATERIAL_CLAIM: {
    title: "A statement needs stronger supporting evidence",
    action: { type: "add-evidence", label: "Add evidence" },
    blocksApproval: false,
    priority: 3,
    fallback: "A statement in the report is not yet backed by strong enough evidence.",
  },
  ASSERTION_COVERAGE_GAP: {
    title: "A section still needs to be reviewed",
    action: { type: "review-section", label: "Review section" },
    blocksApproval: true,
    priority: 4,
    fallback: "A section has not been fully assessed yet.",
  },
  VERIFICATION_STALE: {
    title: "A section's figures are out of date",
    action: { type: "reverify", label: "Re-verify section" },
    blocksApproval: true,
    priority: 5,
    fallback: "A section's underlying data changed since it was last checked.",
  },
  CONFIDENTIALITY_VIOLATION: {
    title: "Confidential information needs review",
    action: { type: "review-confidentiality", label: "Review confidentiality" },
    blocksApproval: true,
    priority: 6,
    fallback: "A confidential source is cited without authorisation.",
  },
  EVIDENCE_HASH_MISMATCH: {
    title: "Cited evidence no longer matches",
    action: { type: "review-evidence", label: "Review evidence" },
    blocksApproval: true,
    priority: 7,
    fallback: "A cited file no longer matches the version the report was based on.",
  },
  CAUSAL_REVIEW_REQUIRED: {
    title: "A cause-and-effect statement needs review",
    action: { type: "review-claim", label: "Review statement" },
    blocksApproval: false,
    priority: 8,
    fallback: "A statement about cause and effect needs a human decision.",
  },
  MISSING_OPTIONAL_EVIDENCE: {
    title: "Optional evidence is missing",
    action: { type: "add-evidence", label: "Add evidence" },
    blocksApproval: false,
    priority: 9,
    fallback: "Some optional supporting evidence has not been attached.",
  },
  VERIFIED: {
    title: "Figure verified",
    action: { type: "review-section", label: "View" },
    blocksApproval: false,
    priority: 10,
    fallback: "This item is verified.",
  },
  DESCRIPTIVE: {
    title: "Descriptive note",
    action: { type: "review-section", label: "View" },
    blocksApproval: false,
    priority: 10,
    fallback: "This is a descriptive statement.",
  },
  AUTO_FIXABLE: {
    title: "Automatically corrected",
    action: { type: "review-section", label: "View" },
    blocksApproval: false,
    priority: 10,
    fallback: "This was corrected automatically.",
  },
  SUBJECTIVE_CONCERN: {
    title: "Subjective concern",
    action: { type: "review-claim", label: "Review statement" },
    blocksApproval: false,
    priority: 10,
    fallback: "A subjective concern should be reviewed.",
  },
};

function referenceFor(issue: GateIssue, claimTextById?: Map<string, string>, sectionTitleById?: Map<string, string>): string {
  if (issue.claimId && claimTextById?.has(issue.claimId)) {
    const text = claimTextById.get(issue.claimId)!.trim();
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  }
  if (issue.sectionId && sectionTitleById?.has(issue.sectionId)) {
    return `In the section "${sectionTitleById.get(issue.sectionId)}".`;
  }
  return KIND_RULES[issue.kind].fallback;
}

/**
 * Collapses the gate's blocking issues into a small, plain-language set.
 * Dedupes issues for the same claim (or the same section+kind), translates to
 * human language, and orders blocking issues first.
 */
export function summarizeSmartReview(input: SmartReviewInput): SmartReviewSummary {
  const seen = new Set<string>();
  const ranked: Array<{ item: SmartReviewIssue; blocksApproval: boolean; priority: number }> = [];

  for (const issue of input.blockingIssues) {
    const rule = KIND_RULES[issue.kind] ?? KIND_RULES.UNSUPPORTED_MATERIAL_CLAIM;
    const key = issue.claimId ?? `${issue.sectionId ?? ""}:${issue.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      blocksApproval: rule.blocksApproval,
      priority: rule.priority,
      item: {
        id: `sr-${key}`,
        severity: rule.blocksApproval ? "BLOCKING" : "WARNING",
        title: rule.title,
        explanation: referenceFor(issue, input.claimTextById, input.sectionTitleById),
        claimId: issue.claimId,
        sectionId: issue.sectionId,
        evidenceId: issue.evidenceId,
        action: rule.action,
        blocksApproval: rule.blocksApproval,
      },
    });
  }

  ranked.sort((a, b) => {
    if (a.blocksApproval !== b.blocksApproval) return a.blocksApproval ? -1 : 1;
    return a.priority - b.priority;
  });

  const items = ranked.map((r) => r.item);
  return {
    issueCount: items.length,
    blockingCount: items.filter((i) => i.blocksApproval).length,
    items,
  };
}
