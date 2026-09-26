import type { Result, TenantId } from "@donordesk/domain";
import type { ProjectMember } from "@donordesk/domain";

export interface IProjectMemberRepository {
  create(member: ProjectMember): Promise<Result<ProjectMember>>;
  update(member: ProjectMember): Promise<Result<ProjectMember>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ProjectMember | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectMember[]>>;
  findByUserAndProject(projectId: string, userId: string, tenantId: TenantId): Promise<Result<ProjectMember | null>>;
  /** Project ids this user has an ACTIVE membership in, for non-admin project-list scoping. */
  listActiveProjectIdsForUser(userId: string, tenantId: TenantId): Promise<Result<string[]>>;
}
