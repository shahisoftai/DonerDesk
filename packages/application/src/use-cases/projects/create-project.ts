import type { Result, DomainError } from "@donordesk/domain";
import { Project, ProjectSetup, ProjectWorkspaceProvisionRequested } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectSetupRepository } from "../../ports/setup.js";
import type { IProjectWorkspaceProviderResolver } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { CreateProjectInput } from "@donordesk/contracts";

export class CreateProjectHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly providerResolver: IProjectWorkspaceProviderResolver,
    private readonly events: IEventBus,
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

    // Provisioning intent: never roll back project creation on storage failure.
    // The workspace status defaults to PENDING; LOCAL/R2 providers are marked
    // NOT_REQUIRED here so the readiness service treats them as satisfied.
    const providerResult = await this.providerResolver.resolve(ctx.tenant.tenantId);
    if (!providerResult.ok) return providerResult;
    const provisionStatus = providerResult.value.provider === "GOOGLE_DRIVE" ? "PENDING" : "NOT_REQUIRED";

    const setup = ProjectSetup.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: id,
      status: provisionStatus,
    });
    const setupSaved = await this.setup.create(setup);
    if (!setupSaved.ok) return setupSaved;

    if (provisionStatus === "PENDING") {
      await this.events.publish([new ProjectWorkspaceProvisionRequested(ctx.tenant.tenantId, id)]);
    }

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
