import type { ProjectRiskTrend, OrganizationRiskSummary, Sector } from "@donordesk/domain";

export interface RiskTrendRepository {
  findById(id: string, tenantId: string): Promise<ProjectRiskTrend | null>;
  findByProjectId(projectId: string, tenantId: string): Promise<ProjectRiskTrend[]>;
  findByOrganization(tenantId: string, organizationId: string): Promise<ProjectRiskTrend[]>;
  save(riskTrend: ProjectRiskTrend): Promise<void>;
  getOrganizationRiskSummary(tenantId: string, organizationId: string): Promise<OrganizationRiskSummary>;
  getRecentTrends(tenantId: string, days: number): Promise<ProjectRiskTrend[]>;
  getSectorRiskSummary(tenantId: string, sector: Sector): Promise<{ sector: Sector; avgRiskScore: number; projectCount: number }>;
}

export interface RiskTrendPrismaRecord {
  id: string;
  tenantId: string;
  projectId: string;
  periodStart: Date;
  periodEnd: Date;
  riskScore: number;
  riskLevel: string;
  contributingFactorsJson: string;
  missingEvidenceCount: number;
  deadlineSlipsCount: number;
  overdueChecklistItemsCount: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface OrganizationPrismaRecord {
  id: string;
  tenantId: string;
  name: string;
  sector: string;
  dataResidency: string;
}

export interface ProjectPrismaRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  sector: string;
  donorName: string;
  title: string;
}
