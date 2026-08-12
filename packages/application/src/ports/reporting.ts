import type { Result, TenantId } from "@donordesk/domain";
import type { ReportingPeriod, ReportDraft, ReportSection, SourceReference } from "@donordesk/domain";

export interface IReportingPeriodRepository {
  create(p: ReportingPeriod): Promise<Result<ReportingPeriod>>;
  update(p: ReportingPeriod): Promise<Result<ReportingPeriod>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportingPeriod | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ReportingPeriod[]>>;
}

export interface IReportDraftRepository {
  create(d: ReportDraft): Promise<Result<ReportDraft>>;
  update(d: ReportDraft): Promise<Result<ReportDraft>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportDraft | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ReportDraft[]>>;
}

export interface IReportSectionRepository {
  create(s: ReportSection): Promise<Result<ReportSection>>;
  update(s: ReportSection): Promise<Result<ReportSection>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ReportSection | null>>;
  findByReportDraft(reportDraftId: string, tenantId: TenantId): Promise<Result<ReportSection[]>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface IReportDraftGenerator {
  generateDraft(input: {
    reportingPeriodId: string;
    projectName: string;
    donorName: string;
    reportType: string;
    templateSections: Array<{ id: string; title: string; description: string; inputType: string; required: boolean; evidenceNeeded: string }>;
    logframeSummary: string;
    indicatorSummary: Array<{ code: string; name: string; baseline: string; target: string; periodAchievement: string; cumulativeAchievement: string; unit?: string }>;
    activities: Array<{ id: string; title: string; location?: string; date: string; participants: number; summary: string; achievements: string; challenges: string; lessonsLearned: string }>;
    evidenceByActivity: Map<string, Array<{ id: string; title: string; type: string }>>;
    evidenceByIndicator: Map<string, Array<{ id: string; title: string; type: string }>>;
    checklistSummary: Array<{ title: string; severity: string; status: string }>;
  }): Promise<Array<{
    sectionId: string;
    title: string;
    content: string;
    sourceReferences: SourceReference[];
    unsupportedClaims: string[];
  }>>;
}
