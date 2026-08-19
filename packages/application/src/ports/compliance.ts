import type { Result, TenantId } from "@donordesk/domain";
import type { ChecklistItem, ChecklistItemType, Severity } from "@donordesk/domain";

export interface IChecklistRepository {
  create(c: ChecklistItem): Promise<Result<ChecklistItem>>;
  update(c: ChecklistItem): Promise<Result<ChecklistItem>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ChecklistItem | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ChecklistItem[]>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ChecklistItem[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  countByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number>>;
  countResolvedByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<number>>;
}

export interface IChecklistDetector {
  detect(input: {
    reportingPeriodId: string;
    projectId: string;
    tenantId: TenantId;
    requiredAnnexes: string[];
    requiredActivities: string[];
    requiredIndicators: string[];
    activitiesCount: number;
    verifiedIndicatorCount: number;
    totalIndicatorCount: number;
    evidenceCount: number;
    requiredEvidenceCount: number;
    sectionStatuses: Array<{ sectionId: string; status: string; hasUnsupportedClaims: boolean }>;
  }): Promise<
    Array<{
      type: ChecklistItemType;
      title: string;
      description: string;
      severity: Severity;
      relatedEntityType?: string;
      relatedEntityId?: string;
    }>
  >;
}

/**
 * Projects material assertion coverage gaps into existing UNSUPPORTED_REPORT_CLAIM
 * checklist items (Phase 2). Deduplication keys make repeated re-assessment
 * idempotent; the projector never computes gate policy itself.
 */
export interface IUnsupportedClaimProjector {
  project(input: {
    tenantId: TenantId;
    periodId: string;
    projectId: string;
    gaps: Array<{ key: string; title: string; description: string }>;
  }): Promise<Result<void>>;
}
