import { ok, type DomainError, type Project, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IProjectMemberRepository } from "../ports/project-members.js";
import type { IProjectRepository } from "../ports/projects.js";

/**
 * Which projects a person can see: an admin sees every project in the organisation, anyone else only the projects they hold an
 * active membership for. One rule for the project list and the portfolio health, so they can never disagree.
 */
export class VisibleProjects {
  constructor(private readonly projects: IProjectRepository, private readonly members: IProjectMemberRepository) {}

  async for(ctx: AuthenticatedContext): Promise<Result<Project[], DomainError>> {
    const all = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!all.ok) return all;
    if (ctx.tenant.role === "ADMIN") return all;
    const ids = await this.members.listActiveProjectIdsForUser(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!ids.ok) return ids;
    const allowed = new Set(ids.value);
    return ok(all.value.filter((p) => allowed.has(p.id)));
  }
}
