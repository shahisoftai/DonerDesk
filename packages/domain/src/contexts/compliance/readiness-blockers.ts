import type { ReadinessBreakdown, ReadinessWeights } from "./readiness-calculator.js";

/** Counts the ranking uses only to word the advice ("3 values still to verify"). */
export interface ReadinessContext {
  totalSections: number;
  sectionsNeedingAttention: number;
  unverifiedIndicators: number;
  unconfirmedCalculations: number;
  openChecklistItems: number;
  evidenceShortfall: number;
  openContradictions: number;
  /** Overall score without the contradiction cap; the gap to `overall` is what clearing them would add. */
  uncappedOverall?: number;
}

export type ReadinessActionKind =
  | "OPEN_REPORT"
  | "OPEN_INPUTS"
  | "OPEN_EVIDENCE"
  | "OPEN_CHECKLIST"
  | "OPEN_LOGFRAME"
  | "OPEN_APPROVAL";

export interface ReadinessBlocker {
  key: string;
  label: string;
  detail: string;
  /** Points of overall readiness this would add if fully cleared. */
  points: number;
  action: { kind: ReadinessActionKind; label: string };
}

interface BlockerRule {
  key: string;
  /** Points available: weight × gap, or a fixed value for non-dimension rules. */
  points(b: ReadinessBreakdown, w: ReadinessWeights, c: ReadinessContext): number;
  label: string;
  detail(c: ReadinessContext): string;
  action: { kind: ReadinessActionKind; label: string };
}

const gap = (score: number, weight: number) => Math.max(0, (100 - score) * weight);

/** Open/closed: add a rule to extend the advice. Ranked by the points each could add. */
export const READINESS_BLOCKER_RULES: ReadonlyArray<BlockerRule> = [
  {
    key: "contradictions",
    points: (b, _w, c) => (c.openContradictions > 0 ? Math.max(0, (c.uncappedOverall ?? b.overall) - b.overall) : 0),
    label: "Fix figures that contradict your data",
    detail: (c) => `${c.openContradictions} statement${c.openContradictions === 1 ? "" : "s"} in the report disagree with verified figures; this caps your score.`,
    action: { kind: "OPEN_REPORT", label: "Open the report" },
  },
  {
    key: "indicators",
    points: (b, w) => gap(b.indicatorsScore, w.indicators),
    label: "Verify indicator values",
    detail: (c) => (c.unverifiedIndicators > 0 ? `${c.unverifiedIndicators} value${c.unverifiedIndicators === 1 ? "" : "s"} still to verify.` : "No indicator values entered yet."),
    action: { kind: "OPEN_INPUTS", label: "Enter and verify values" },
  },
  {
    key: "evidence",
    points: (b, w) => gap(b.evidenceScore, w.evidence),
    label: "Attach supporting evidence",
    detail: (c) => (c.evidenceShortfall > 0 ? `About ${c.evidenceShortfall} more file${c.evidenceShortfall === 1 ? "" : "s"} needed.` : "Evidence is below what the template asks for."),
    action: { kind: "OPEN_EVIDENCE", label: "Attach evidence" },
  },
  {
    key: "sections",
    points: (b, w) => gap(b.sectionsScore, w.sections),
    label: "Review the report sections",
    detail: (c) => (c.totalSections === 0 ? "Generate a draft to start." : `${c.sectionsNeedingAttention} of ${c.totalSections} section${c.totalSections === 1 ? "" : "s"} still need attention.`),
    action: { kind: "OPEN_REPORT", label: "Review sections" },
  },
  {
    key: "checklist",
    points: (b, w) => gap(b.checklistScore, w.checklist),
    label: "Clear the checklist",
    detail: (c) => `${c.openChecklistItems} open item${c.openChecklistItems === 1 ? "" : "s"}${c.unconfirmedCalculations > 0 ? `, including ${c.unconfirmedCalculations} indicator calculation${c.unconfirmedCalculations === 1 ? "" : "s"} to confirm` : ""}.`,
    action: { kind: "OPEN_CHECKLIST", label: "Open the checklist" },
  },
  {
    key: "approval",
    points: (b, w) => gap(b.approvalScore, w.approval),
    label: "Get the report approved",
    detail: () => "Approval is the last step before submission.",
    action: { kind: "OPEN_APPROVAL", label: "Open approval" },
  },
];

/** The biggest things holding the score back, largest first (stable on ties), at most `limit`. */
export function rankReadinessBlockers(
  breakdown: ReadinessBreakdown,
  context: ReadinessContext,
  limit = 3,
  rules: ReadonlyArray<BlockerRule> = READINESS_BLOCKER_RULES,
): ReadinessBlocker[] {
  return rules
    .map((rule, order) => ({ rule, order, points: Math.round(rule.points(breakdown, breakdown.weights, context)) }))
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points || a.order - b.order)
    .slice(0, limit)
    .map(({ rule, points }) => ({ key: rule.key, label: rule.label, detail: rule.detail(context), points, action: rule.action }));
}
