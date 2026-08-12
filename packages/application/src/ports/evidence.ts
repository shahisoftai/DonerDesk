import type { Result, TenantId } from "@donordesk/domain";
import type { EvidenceFile, EvidenceType, ConfidentialityLevel, EvidenceVerificationStatus, SuggestedTag } from "@donordesk/domain";

export interface EvidenceFilter {
  projectId?: string;
  reportingPeriodId?: string;
  activityId?: string;
  indicatorId?: string;
  evidenceType?: EvidenceType;
  location?: string;
  uploadedById?: string;
  verificationStatus?: EvidenceVerificationStatus;
  confidentialityLevel?: ConfidentialityLevel;
  query?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

export interface EvidenceListResult {
  items: EvidenceFile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IEvidenceRepository {
  create(e: EvidenceFile): Promise<Result<EvidenceFile>>;
  update(e: EvidenceFile): Promise<Result<EvidenceFile>>;
  findById(id: string, tenantId: TenantId): Promise<Result<EvidenceFile | null>>;
  search(filter: EvidenceFilter, tenantId: TenantId): Promise<Result<EvidenceListResult>>;
  countByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number>>;
  countVerifiedByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IEvidenceTagger {
  suggestTags(input: {
    fileName: string;
    fileType: string;
    extractedText?: string;
    existingProjectName?: string;
    existingActivities: Array<{ id: string; title: string }>;
    existingIndicators: Array<{ id: string; code: string; name: string }>;
  }): Promise<{
    summary: string;
    tags: SuggestedTag[];
    sensitivityWarning?: string;
    model: string;
  }>;
}

export interface IDocumentParser {
  parse(input: { buffer: Buffer; fileType: string; fileName: string }): Promise<{ text: string; metadata?: Record<string, unknown> }>;
}
