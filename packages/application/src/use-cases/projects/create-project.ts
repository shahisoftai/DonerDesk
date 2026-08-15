import type { Result, DomainError } from "@donordesk/domain";
import { Project, ProjectSetup, ReportingProfile, ProjectWorkspaceProvisionRequested } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectSetupRepository, IReportingProfileRepository } from "../../ports/setup.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IProjectWorkspaceProviderResolver } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { CreateProjectInput } from "@donordesk/contracts";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { entitlementLimitError } from "../../services/entitlement-service.js";

export class CreateProjectHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly organizations: IOrganizationRepository,
    private readonly providerResolver: IProjectWorkspaceProviderResolver,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateProjectInput): Promise<Result<{ id: string }, DomainError>> {
    // Capacity enforcement: resolve the effective plan and current project
    // count before creating. A tenant already at its project limit is rejected
    // with a structured PLAN_LIMIT_REACHED error.
    const entitlementResult = await this.entitlements.resolve({ tenantId: ctx.tenant.tenantId.toString() });
    if (!entitlementResult.ok) return entitlementResult;
    const entitlement = entitlementResult.value;
    const limit = entitlement.limits.maxActiveProjects;
    if (limit !== null) {
      const usageResult = await this.entitlements.usageSnapshot({ tenantId: ctx.tenant.tenantId.toString() });
      if (!usageResult.ok) return usageResult;
      if (usageResult.value.activeProjects >= limit) {
        return {
          ok: false,
          error: entitlementLimitError("PROJECTS", limit, usageResult.value.activeProjects),
        };
      }
    }

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

    // Seed the project's reporting profile from the account-wide defaults so
    // new projects inherit the org's tone/language/rules (Onboarding step).
    const orgResult = await this.organizations.findByTenant(ctx.tenant.tenantId);
    if (orgResult.ok && orgResult.value) {
      const org = orgResult.value;
      const profile = ReportingProfile.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: id,
        language: org.defaultLanguage,
        tone: org.reportingDefaults.tone,
        formattingRules: org.reportingDefaults.formattingRules,
        deadlineOffsetDays: org.reportingDefaults.deadlineOffsetDays,
        autoPeriodCreation: org.reportingDefaults.autoPeriodCreation,
        createdById: ctx.tenant.userId,
      });
      await this.profiles.create(profile);
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
