import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";

export class GetProjectHandler {
  constructor(private readonly projects: IProjectRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown, DomainError>> {
    const r = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const p = r.value;
    return {
      ok: true,
      value: {
        id: p.id,
        title: p.title,
        projectCode: p.projectCode,
        donorName: p.donorName,
        implementingOrganization: p.implementingOrganization,
        partnerOrganization: p.partnerOrganization,
        country: p.country,
        region: p.region,
        district: p.district,
        sector: p.sector,
        status: p.status,
        reportingFrequency: p.reportingFrequency,
        startDate: p.duration.start.toISOString(),
        endDate: p.duration.end.toISOString(),
        daysRemaining: p.daysRemaining(),
        budget: p.budget ? { amount: p.budget.amount, currency: p.budget.currency } : undefined,
        description: p.description,
        primaryContactName: p.primaryContactName,
        projectManagerId: p.projectManagerId,
        meOfficerId: p.meOfficerId,
        reportingOfficerId: p.reportingOfficerId,
        workspaceRootId: p.workspaceRootId,
      },
    };
  }
}
