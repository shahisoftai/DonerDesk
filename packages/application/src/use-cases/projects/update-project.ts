import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateProjectSchema } from "@donordesk/contracts";
import type { z } from "zod";

export class UpdateProjectHandler {
  constructor(private readonly projects: IProjectRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: z.infer<typeof UpdateProjectSchema>): Promise<Result<void, DomainError>> {
    const r = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const project = r.value;
    const before = JSON.stringify(project);

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
      }
    }
    if (input.startDate && input.endDate) {
      // Reassign duration via details update would require deeper mutation; keep simple: only update non-duration fields here.
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
