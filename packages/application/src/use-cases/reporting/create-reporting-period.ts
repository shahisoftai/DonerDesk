import type { Result, DomainError, TenantId } from "@donordesk/domain";
import { ReportingPeriod, DateRange, DomainError as DE, ReportingPeriodCreated } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IProjectSetupRepository, IReportingProfileRepository } from "../../ports/setup.js";
import type { IProjectReadinessService } from "../../ports/projects.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { CreateReportingPeriodInput } from "@donordesk/contracts";

/**
 * Authoritative reporting-period creation. The period is the first step of the
 * reporting engine, so this handler is the single gate that enforces setup
 * readiness, ownership, project date bounds, and overlap rules, and stores the
 * immutable effective template/profile snapshot for the period.
 */
export class CreateReportingPeriodHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IReportingPeriodRepository,
    private readonly projects: IProjectRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly readiness: IProjectReadinessService,
    private readonly audit: IAuditLogger,
    private readonly events: IEventBus,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateReportingPeriodInput): Promise<Result<{ id: string }, DomainError>> {
    const tenantId: TenantId = ctx.tenant.tenantId;

    // 1. Load the Project, tenant-qualified; cross-tenant ids return NOT_FOUND.
    const projectResult = await this.projects.findById(input.projectId, tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DE.notFound("Project", input.projectId) };
    const project = projectResult.value;

    // Lifecycle: completed/archived projects never open new periods.
    if (project.status === "COMPLETED" || project.status === "ARCHIVED") {
      return {
        ok: false,
        error: DE.invalidTransition(`Cannot create a reporting period for a ${project.status.toLowerCase()} project`),
      };
    }

    // 2. Setup readiness gate.
    const readinessResult = await this.readiness.compute(input.projectId, tenantId);
    if (!readinessResult.ok) return readinessResult;
    if (!readinessResult.value.ready) {
      return {
        ok: false,
        error: DE.policyDenied("Project setup is not complete; reporting periods are unavailable until the project is ready", {
          blockers: readinessResult.value.blockers.map((b) => b.code),
        }),
      };
    }

    // 3. Resolve the effective template (profile default or submitted).
    const profileResult = await this.profiles.findByProject(input.projectId, tenantId);
    if (!profileResult.ok) return profileResult;
    const profile = profileResult.value;

    let templateId = input.donorTemplateId ?? profile?.defaultTemplateId;
    let template = null;
    if (templateId) {
      const templateResult = await this.templates.findById(templateId, tenantId);
      if (!templateResult.ok) return templateResult;
      template = templateResult.value;
      if (!template || template.projectId !== input.projectId) {
        return { ok: false, error: DE.notFound("DonorTemplate", templateId) };
      }
    }

    // 4. Validate dates against project bounds + overlap.
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const deadline = new Date(input.deadline);

    if (start < project.duration.start || end > project.duration.end) {
      return {
        ok: false,
        error: DE.validation(
          `Reporting period must fall within the project duration (${project.duration.start.toISOString()} to ${project.duration.end.toISOString()})`,
        ),
      };
    }

    const existingResult = await this.repo.findByProject(input.projectId, tenantId);
    if (!existingResult.ok) return existingResult;
    for (const existing of existingResult.value) {
      if (existing.duration.overlaps(DateRange.create(start, end))) {
        return {
          ok: false,
          error: DE.conflict("Reporting period overlaps an existing period for this project", {
            existingPeriodId: existing.id,
          }),
        };
      }
    }

    // 5. Build the immutable effective snapshots.
    const reportingProfileSnapshotJson = profile
      ? JSON.stringify({
          version: profile.version,
          language: profile.language,
          tone: profile.tone,
          writingStyle: profile.writingStyle,
          audienceNotes: profile.audienceNotes,
          formattingRules: profile.formattingRules,
          specialRequirements: profile.specialRequirements,
          sectionOverrides: profile.sectionOverrides,
          deadlineOffsetDays: profile.deadlineOffsetDays,
        })
      : "{}";

    const templateSnapshotJson = template
      ? JSON.stringify({
          id: template.id,
          templateName: template.templateName,
          donorName: template.donorName,
          reportType: template.reportType,
          language: template.language,
          sections: template.sections,
        })
      : "{}";

    // 6. Save + audit.
    const id = this.ids.generate();
    const period = ReportingPeriod.create({
      id,
      tenantId: tenantId.toString(),
      projectId: input.projectId,
      donorTemplateId: templateId,
      reportType: input.reportType,
      startDate: start,
      endDate: end,
      deadline,
      internalReviewDeadline: input.internalReviewDeadline ? new Date(input.internalReviewDeadline) : undefined,
      responsibleOfficerId: input.responsibleOfficerId,
      reportingProfileSnapshotJson,
      templateSnapshotJson,
    });
    const saved = await this.repo.create(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting.period.created",
      entityType: "reporting_period",
      entityId: id,
      projectId: input.projectId,
      newValue: JSON.stringify({ reportType: input.reportType, startDate: input.startDate, endDate: input.endDate, templateId: templateId ?? null }),
    });
    await this.events.publish([new ReportingPeriodCreated(tenantId, id, input.projectId)]);
    return { ok: true, value: { id } };
  }
}
