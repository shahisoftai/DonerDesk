import type { Result, TenantId } from "@donordesk/domain";
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
