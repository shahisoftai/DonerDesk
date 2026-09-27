import type { DisaggregationEntry, IndicatorUpdate } from "@donordesk/domain";

export interface IndicatorUpdateView {
  id: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments?: string;
  dataSource?: string;
  verificationStatus: string;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachedEvidenceIds: string[];
  disaggregation: DisaggregationEntry[];
}

export function toIndicatorUpdateView(update: IndicatorUpdate): IndicatorUpdateView {
  return {
    id: update.id,
    periodAchievement: update.periodAchievement,
    cumulativeAchievement: update.cumulativeAchievement,
    comments: update.comments,
    dataSource: update.dataSource,
    verificationStatus: update.verificationStatus,
    verifiedAt: update.verifiedAt ?? null,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    attachedEvidenceIds: update.attachedEvidenceIds,
    disaggregation: update.disaggregation,
  };
}
