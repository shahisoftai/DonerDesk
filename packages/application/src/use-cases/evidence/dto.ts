import type { EvidenceFile } from "@donordesk/domain";

export interface EvidenceDto {
  id: string;
  projectId: string;
  reportingPeriodId?: string;
  activityId?: string;
  indicatorId?: string;
  indicatorUpdateId?: string;
  fileName: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storageProvider: string;
  driveFileId?: string;
  driveWebLink?: string;
  evidenceType: string;
  location?: string;
  activityDate?: string;
  /** When the file was uploaded (not the date of the activity it documents). */
  uploadedAt: string;
  uploadedById: string;
  verificationStatus: string;
  confidentialityLevel: string;
  notes?: string;
  aiSummary?: string;
  extractedText?: string;
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
    indicatorUpdateId: e.indicatorUpdateId,
    fileName: e.fileName,
    title: e.title,
    fileUrl: e.fileUrl,
    fileType: e.fileType,
    fileSize: e.fileSize,
    storageProvider: e.storageProvider,
    driveFileId: e.driveFileId,
    driveWebLink: e.driveWebLink,
    evidenceType: e.evidenceType,
    location: e.location,
    activityDate: e.activityDate?.toISOString(),
    uploadedAt: e.createdAt.toISOString(),
    uploadedById: e.uploadedById,
    verificationStatus: e.verificationStatus,
    confidentialityLevel: e.confidentialityLevel,
    notes: e.notes,
    aiSummary: e.aiSummary,
    extractedText: e.extractedText,
    aiSuggestedTags: e.aiSuggestedTags,
    sensitivityWarning: e.sensitivityWarning,
  };
}
