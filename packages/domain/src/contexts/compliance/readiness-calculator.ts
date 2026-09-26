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
}

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
}

export const READINESS_WEIGHTS = {
  sections: 0.25,
  indicators: 0.2,
  evidence: 0.25,
  checklist: 0.2,
  approval: 0.1,
} as const;

export const DATA_QUALITY_PENALTY = 15;

export function calculateReadiness(input: ReadinessInput): ReadinessBreakdown {
  const sectionsScore = input.totalSections === 0 ? 0 : (input.approvedSections / input.totalSections) * 100;
  const indicatorsScore = input.totalIndicators === 0 ? 0 : (input.verifiedIndicators / input.totalIndicators) * 100;
  const evidenceScore =
    input.requiredEvidenceCount === 0 ? 100 : Math.min(100, (input.attachedEvidenceCount / input.requiredEvidenceCount) * 100);
  const checklistScore =
    input.totalChecklistItems === 0 ? 100 : (input.resolvedOrAcceptedItems / input.totalChecklistItems) * 100;
  const approvalScore = Math.max(0, Math.min(100, input.approvalProgress));

  const baseOverall = Math.round(
    sectionsScore * READINESS_WEIGHTS.sections +
      indicatorsScore * READINESS_WEIGHTS.indicators +
      evidenceScore * READINESS_WEIGHTS.evidence +
      checklistScore * READINESS_WEIGHTS.checklist +
      approvalScore * READINESS_WEIGHTS.approval,
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
  };
}

