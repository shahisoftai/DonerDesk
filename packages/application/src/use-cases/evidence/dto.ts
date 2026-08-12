import type { EvidenceFile } from "@donordesk/domain";

export interface EvidenceDto {
  id: string;
  projectId: string;
  reportingPeriodId?: string;
  activityId?: string;
  indicatorId?: string;
  fileName: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  evidenceType: string;
  location?: string;
  activityDate?: string;
  uploadedById: string;
  verificationStatus: string;
  confidentialityLevel: string;
  notes?: string;
  aiSummary?: string;
  aiSuggestedTags: unknown[];
  sensitivityWarning?: string;
}

export function toEvidenceDto(e: EvidenceFile): EvidenceDto {
  return {
    id: e.id,
    projectId: e.projectId,
    reportingPeriodId: e.reportingPeriodId,
    activityId: e.activityId,
    indicatorId: e.indicatorId,
    fileName: e.fileName,
    title: e.title,
    fileUrl: e.fileUrl,
    fileType: e.fileType,
    fileSize: e.fileSize,
    evidenceType: e.evidenceType,
    location: e.location,
    activityDate: e.activityDate?.toISOString(),
    uploadedById: e.uploadedById,
    verificationStatus: e.verificationStatus,
    confidentialityLevel: e.confidentialityLevel,
    notes: e.notes,
    aiSummary: e.aiSummary,
    aiSuggestedTags: e.aiSuggestedTags,
    sensitivityWarning: e.sensitivityWarning,
  };
}
