import type { ProjectRisk, Result, TenantId } from "@donordesk/domain";

export interface IProjectRiskRepository {
  create(risk: ProjectRisk): Promise<Result<ProjectRisk>>;
  update(risk: ProjectRisk): Promise<Result<ProjectRisk>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ProjectRisk | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectRisk[]>>;
}
