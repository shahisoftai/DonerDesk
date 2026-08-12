import type { Result } from "@donordesk/domain";
import { DomainError, Project, TenantId, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateProjectInput } from "@donordesk/contracts";

export class CreateProjectHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly projects: IProjectRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateProjectInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const project = Project.create({
      id,
      tenantId: ctx.tenant.tenantId,
      props: {
        title: input.title,
        projectCode: input.projectCode,
        donorName: input.donorName,
        implementingOrganization: input.implementingOrganization,
        partnerOrganization: input.partnerOrganization,
        country: input.country,
        region: input.region,
        district: input.district,
        sector: input.sector,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        budgetAmount: input.budgetAmount,
        budgetCurrency: input.budgetCurrency,
        reportingFrequency: input.reportingFrequency,
        description: input.description,
        primaryContactName: input.primaryContactName,
        projectManagerId: input.projectManagerId,
        meOfficerId: input.meOfficerId,
        reportingOfficerId: input.reportingOfficerId,
      },
    });
    const saved = await this.projects.create(project);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.created",
      entityType: "project",
      entityId: id,
      projectId: id,
      newValue: project.title,
    });
    return { ok: true, value: { id } };
  }
}

export { Permissions };
