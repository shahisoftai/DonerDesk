export interface ReadinessInput {
  totalSections: number;
  approvedSections: number;
  totalIndicators: number;
  verifiedIndicators: number;
  requiredEvidenceCount: number;
  attachedEvidenceCount: number;
  totalChecklistItems: number;
  resolvedOrAcceptedItems: number;
  /** 0–100 progress through the report approval workflow (0 = not started, 50 = under review, 100 = approved). */
  approvalProgress: number;
  /**
   * Unresolved content-derived contradiction blockers from the cross-section
   * lint (figures not in verified data, percentages without a basis,
   * same-metric divergence, disaggregation contradictions). Optional for
   * backward compatibility; each unresolved blocker costs 15 quality points
   * and caps the overall readiness. Readiness 100 must never again be
   * achievable while the report text contradicts the verified data.
   */
  dataQualityBlockers?: number;
  /**
   * Where the report is in its life. Defaults to SUBMISSION, which scores exactly as before.
   * DRAFTING (no draft yet, or a draft not yet sent to review) does not charge the approval
   * dimension and scores sections by `cleanSections` (drafted with no open issue) instead of
   * approved sections, so a correct first draft is not shown as 0 %.
   */
  stage?: ReadinessStage;
  /** Sections drafted with no unresolved issue; used in DRAFTING (falls back to approved sections). */
  cleanSections?: number;
}

export type ReadinessStage = "DRAFTING" | "IN_REVIEW" | "SUBMISSION";

export type ReadinessWeights = { sections: number; indicators: number; evidence: number; checklist: number; approval: number };

export interface ReadinessBreakdown {
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
  overall: number;
  /**
   * Quality dimension (0–100): 100 with no unresolved contradiction blockers,
   * minus 15 per blocker (floor 0). Mirrors `overall` when the caller did not
   * supply `dataQualityBlockers`, so legacy consumers see identical values.
   */
  qualityScore: number;
  /** Number of unresolved contradiction blockers that degraded the score. */
  dataQualityBlockers: number;
  stage: ReadinessStage;
  /** The weights this score used (they depend on the stage). */
  weights: ReadinessWeights;
}

export const READINESS_WEIGHTS = {
  sections: 0.25,
  indicators: 0.2,
  evidence: 0.25,
  checklist: 0.2,
  approval: 0.1,
} as const;

/** Weights per stage (each sums to 1). SUBMISSION/IN_REVIEW are the original weights. */
export const READINESS_WEIGHTS_BY_STAGE: Record<ReadinessStage, ReadinessWeights> = {
  DRAFTING: { sections: 0.3, indicators: 0.25, evidence: 0.25, checklist: 0.2, approval: 0 },
  IN_REVIEW: READINESS_WEIGHTS,
  SUBMISSION: READINESS_WEIGHTS,
};

/** Stage from the state of the report's draft (none / DRAFT → DRAFTING). */
export function readinessStageFor(draftStatus: string | undefined | null): ReadinessStage {
  if (draftStatus === "UNDER_REVIEW") return "IN_REVIEW";
  if (draftStatus === "APPROVED" || draftStatus === "EXPORTED" || draftStatus === "SUBMITTED") return "SUBMISSION";
  return "DRAFTING";
}

export const DATA_QUALITY_PENALTY = 15;

export function calculateReadiness(input: ReadinessInput): ReadinessBreakdown {
  const stage: ReadinessStage = input.stage ?? "SUBMISSION";
  const weights = READINESS_WEIGHTS_BY_STAGE[stage];
  const sectionsDone = stage === "DRAFTING" ? Math.min(input.cleanSections ?? input.approvedSections, input.totalSections) : input.approvedSections;
  const sectionsScore = input.totalSections === 0 ? 0 : (sectionsDone / input.totalSections) * 100;
  const indicatorsScore = input.totalIndicators === 0 ? 0 : (input.verifiedIndicators / input.totalIndicators) * 100;
  const evidenceScore =
    input.requiredEvidenceCount === 0 ? 100 : Math.min(100, (input.attachedEvidenceCount / input.requiredEvidenceCount) * 100);
  const checklistScore =
    input.totalChecklistItems === 0 ? 100 : (input.resolvedOrAcceptedItems / input.totalChecklistItems) * 100;
  const approvalScore = Math.max(0, Math.min(100, input.approvalProgress));

  const baseOverall = Math.round(
    sectionsScore * weights.sections +
      indicatorsScore * weights.indicators +
      evidenceScore * weights.evidence +
      checklistScore * weights.checklist +
      approvalScore * weights.approval,
  );

  const blockers = input.dataQualityBlockers === undefined ? 0 : Math.max(0, Math.trunc(input.dataQualityBlockers));
  const qualityScore = input.dataQualityBlockers === undefined ? baseOverall : Math.max(0, 100 - blockers * DATA_QUALITY_PENALTY);
  const overall = blockers > 0 ? Math.min(baseOverall, qualityScore) : baseOverall;

  return {
    sectionsScore: Math.round(sectionsScore),
    indicatorsScore: Math.round(indicatorsScore),
    evidenceScore: Math.round(evidenceScore),
    checklistScore: Math.round(checklistScore),
    approvalScore: Math.round(approvalScore),
    overall,
    qualityScore,
    dataQualityBlockers: blockers,
    stage,
    weights,
  };
}

