import type { Result, TenantId } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { Project } from "@donordesk/domain";

export interface CreateProjectArgs {
  id: string;
  tenantId: TenantId;
  title: string;
  projectCode: string;
  donorName: string;
  implementingOrganization: string;
  partnerOrganization?: string;
  country: string;
  region?: string;
  district?: string;
  sector: import("@donordesk/domain").Sector;
  startDate: Date;
  endDate: Date;
  budgetAmount?: number;
  budgetCurrency?: string;
  reportingFrequency: import("@donordesk/domain").ReportingFrequency;
  description?: string;
  primaryContactName?: string;
  projectManagerId?: string;
  meOfficerId?: string;
  reportingOfficerId?: string;
}

export interface IProjectRepository {
  create(p: Project): Promise<Result<Project>>;
  update(p: Project): Promise<Result<Project>>;
  findById(id: string, tenantId: TenantId): Promise<Result<Project | null>>;
  listByTenant(tenantId: TenantId): Promise<Result<Project[]>>;
}

export type ProjectSetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "READY" | "ACTION_REQUIRED";

export type SetupBlockerCode =
  | "WORKSPACE_PENDING"
  | "WORKSPACE_ACCESS_REVOKED"
  | "WORKSPACE_PROVISION_FAILED"
  | "REPORTING_PROFILE_MISSING"
  | "DEFAULT_TEMPLATE_MISSING"
  | "TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS"
  | "TEMPLATE_SECTION_IDS_INVALID"
  | "NO_REPORTABLE_INDICATORS"
  | "INDICATOR_CONFIGURATION_INCOMPLETE"
  | "SECTION_OVERRIDE_INVALID";

export interface SetupBlocker {
  code: SetupBlockerCode;
  label: string;
  href?: string;
  retryable?: boolean;
}

export interface ProjectReadiness {
  ready: boolean;
  status: ProjectSetupStatus;
  blockers: SetupBlocker[];
  nextAction?: SetupBlocker;
}

export interface ProjectReadinessSnapshot {
  /** Operational workspace provisioning state. */
  workspace: {
    provisionStatus: string;
    provisionError?: string;
    deepLink?: string;
    rootId?: string;
  };
  /** Effective reporting profile state. */
  profile: {
    exists: boolean;
    version?: number;
    defaultTemplateId?: string;
    language?: string;
    tone?: string;
  };
  /** Active template state. */
  template: {
    exists: boolean;
    id?: string;
    name?: string;
    reviewedRequiredSectionCount: number;
  };
  /** Indicator readiness state. */
  indicators: {
    total: number;
    reportable: number;
    incomplete: number;
  };
  /** Soft team recommendation (not a gate). */
  team: {
    assigned: boolean;
    memberCount: number;
  };
  acknowledgedAt?: string;
  acknowledgedById?: string;
}

export interface IProjectReadinessService {
  compute(projectId: string, tenantId: TenantId): Promise<Result<ProjectReadiness, DomainError>>;
  snapshot(projectId: string, tenantId: TenantId): Promise<Result<ProjectReadinessSnapshot, DomainError>>;
}
