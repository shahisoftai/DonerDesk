import type { Result } from "@donordesk/domain";
import { DomainError, describePeriodTypes, type PeriodTypeOption } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";

/** "What you can create" for a project: each report type with its reason and next step (rules from the domain). */
export class GetPeriodOptionsHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: IActivityUpdateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ projectStatus: string; types: PeriodTypeOption[] }, DomainError>> {
    const project = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const periods = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
    if (!periods.ok) return periods;
    const activities = await this.activities.findByProject(projectId, ctx.tenant.tenantId);
    if (!activities.ok) return activities;
    const types = describePeriodTypes({
      projectStart: project.value.duration.start,
      projectEnd: project.value.duration.end,
      projectStatus: project.value.status,
      existing: periods.value.map((p) => ({ id: p.id, reportType: p.reportType, start: p.duration.start, end: p.duration.end })),
      activityCount: activities.value.length,
    });
    return { ok: true, value: { projectStatus: project.value.status, types } };
  }
}
