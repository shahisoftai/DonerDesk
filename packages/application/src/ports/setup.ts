import type { Result, TenantId, ProjectSetup, ReportingProfile } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";

export interface IProjectSetupRepository {
  create(p: ProjectSetup): Promise<Result<ProjectSetup, DomainError>>;
  update(p: ProjectSetup): Promise<Result<ProjectSetup, DomainError>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectSetup | null, DomainError>>;
  ensureForProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectSetup, DomainError>>;
}

export interface IReportingProfileRepository {
  create(p: ReportingProfile): Promise<Result<ReportingProfile, DomainError>>;
  update(p: ReportingProfile): Promise<Result<ReportingProfile, DomainError>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ReportingProfile | null, DomainError>>;
}

export interface UpsertReportingProfileResult {
  profile: ReportingProfile;
  created: boolean;
}
