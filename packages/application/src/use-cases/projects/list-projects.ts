import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";

/**
 * ADMIN sees every project in the tenant. Any other role sees only projects
 * they hold an ACTIVE ProjectMember row for — closes the gap where the list
 * was tenant-wide for every role regardless of project assignment (tracked
 * as FE-B03). Mirrors the assignedProjectIds/outsideProjectScope pattern
 * already used by the field-level ABAC policy engine.
 */
export class ListProjectsHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly projectMembers: IProjectMemberRepository,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<Array<unknown>, DomainError>> {
    const r = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!r.ok) return r;

    let items = r.value;
    if (ctx.tenant.role !== "ADMIN") {
      const memberIds = await this.projectMembers.listActiveProjectIdsForUser(ctx.tenant.userId, ctx.tenant.tenantId);
      if (!memberIds.ok) return memberIds;
      const allowed = new Set(memberIds.value);
      items = items.filter((p) => allowed.has(p.id));
    }

    return {
      ok: true,
      value: items.map((p) => ({
        id: p.id,
        title: p.title,
        projectCode: p.projectCode,
        donorName: p.donorName,
        country: p.country,
        sector: p.sector,
        status: p.status,
        reportingFrequency: p.reportingFrequency,
        startDate: p.duration.start.toISOString(),
        endDate: p.duration.end.toISOString(),
        daysRemaining: p.daysRemaining(),
        workspaceRootId: p.workspaceRootId,
        isDemo: p.isDemo,
      })),
    };
  }
}
