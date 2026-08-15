import { DomainError } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import { Money, DateRange } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateProjectInput } from "@donordesk/contracts";

/**
 * Updates a project. Dates and budget are now editable (must-fix in Feature 18):
 * duration changes are re-validated against existing reporting periods so we
 * never orphan a period outside the new project window.
 */
export class UpdateProjectHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: UpdateProjectInput): Promise<Result<void, DomainError>> {
    const r = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const project = r.value;
    const before = JSON.stringify(project);

    // Status transitions (lifecycle).
    if (input.status) {
      switch (input.status) {
        case "ACTIVE":
          project.activate();
          break;
        case "PAUSED":
          project.pause();
          break;
        case "COMPLETED":
          project.complete();
          break;
        case "ARCHIVED":
          project.archive();
          break;
        case "DRAFT":
          if (project.status === "ARCHIVED") project.restore();
          break;
      }
    }

    // Duration editability: reject changes that would invalidate existing periods.
    if (input.startDate || input.endDate) {
      const newStart = input.startDate ? new Date(input.startDate) : project.duration.start;
      const newEnd = input.endDate ? new Date(input.endDate) : project.duration.end;
      if (newEnd.getTime() < newStart.getTime()) {
        return { ok: false, error: DomainError.validation("endDate must be on or after startDate") };
      }
      const existingPeriods = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
      if (!existingPeriods.ok) return existingPeriods;
      for (const period of existingPeriods.value) {
        if (period.duration.start < newStart || period.duration.end > newEnd) {
          return {
            ok: false,
            error: DomainError.conflict(
              "Cannot shrink project dates: an existing reporting period would fall outside the new project window",
              { periodId: period.id },
            ),
          };
        }
      }
      project.updateDetails({
        duration: DateRange.create(newStart, newEnd),
      });
    }

    // Budget editability (currency ISO-4217 validated by the contract).
    if (input.budgetAmount !== undefined || input.budgetCurrency !== undefined) {
      const amount = input.budgetAmount ?? project.budget?.amount;
      const currency = input.budgetCurrency ?? project.budget?.currency ?? "USD";
      if (amount !== undefined) {
        project.updateDetails({ budget: Money.create(amount, currency) });
      } else if (input.budgetCurrency) {
        // Preserve amount if only currency changes.
        project.updateDetails({
          budget: project.budget ? Money.create(project.budget.amount, currency) : undefined,
        });
      }
    }

    project.updateDetails({
      title: input.title,
      projectCode: input.projectCode,
      donorName: input.donorName,
      implementingOrganization: input.implementingOrganization,
      partnerOrganization: input.partnerOrganization,
      country: input.country,
      region: input.region,
      district: input.district,
      sector: input.sector,
      reportingFrequency: input.reportingFrequency,
      description: input.description,
      primaryContactName: input.primaryContactName,
      projectManagerId: input.projectManagerId,
      meOfficerId: input.meOfficerId,
      reportingOfficerId: input.reportingOfficerId,
    });

    if (input.projectManagerId || input.meOfficerId || input.reportingOfficerId) {
      project.assignStaff({
        projectManagerId: input.projectManagerId,
        meOfficerId: input.meOfficerId,
        reportingOfficerId: input.reportingOfficerId,
      });
    }

    const saved = await this.projects.update(project);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.updated",
      entityType: "project",
      entityId: projectId,
      projectId,
      oldValue: before,
      newValue: JSON.stringify(project),
    });
    return { ok: true, value: undefined };
  }
}
