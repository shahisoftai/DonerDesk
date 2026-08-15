import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";

export class ListProjectsHandler {
  constructor(private readonly projects: IProjectRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<Array<unknown>, DomainError>> {
    const r = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((p) => ({
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
      })),
    };
  }
}
