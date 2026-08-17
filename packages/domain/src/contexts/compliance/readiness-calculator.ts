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
}

export interface ReadinessBreakdown {
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
  overall: number;
}

export const READINESS_WEIGHTS = {
  sections: 0.25,
  indicators: 0.20,
  evidence: 0.25,
  checklist: 0.20,
  approval: 0.10,
} as const;

export function calculateReadiness(input: ReadinessInput): ReadinessBreakdown {
  const sectionsScore = input.totalSections === 0 ? 0 : (input.approvedSections / input.totalSections) * 100;
  const indicatorsScore = input.totalIndicators === 0 ? 0 : (input.verifiedIndicators / input.totalIndicators) * 100;
  const evidenceScore =
    input.requiredEvidenceCount === 0 ? 100 : Math.min(100, (input.attachedEvidenceCount / input.requiredEvidenceCount) * 100);
  const checklistScore =
    input.totalChecklistItems === 0 ? 100 : (input.resolvedOrAcceptedItems / input.totalChecklistItems) * 100;
  const approvalScore = Math.max(0, Math.min(100, input.approvalProgress));

  const overall = Math.round(
    sectionsScore * READINESS_WEIGHTS.sections +
      indicatorsScore * READINESS_WEIGHTS.indicators +
      evidenceScore * READINESS_WEIGHTS.evidence +
      checklistScore * READINESS_WEIGHTS.checklist +
      approvalScore * READINESS_WEIGHTS.approval,
  );

  return {
    sectionsScore: Math.round(sectionsScore),
    indicatorsScore: Math.round(indicatorsScore),
    evidenceScore: Math.round(evidenceScore),
    checklistScore: Math.round(checklistScore),
    approvalScore: Math.round(approvalScore),
    overall,
  };
}
