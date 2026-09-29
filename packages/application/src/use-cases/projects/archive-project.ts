import { DomainError, Permissions } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IAuditLogger } from "../../ports/core.js";

export class ArchiveProjectHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<void, DomainError>> {
    // Archiving is a management op on the project, same permission as editing
    // it — defense in depth alongside the route-level authorization rule.
    Permissions.require(ctx.tenant.role as import("@donordesk/domain").Role, "project.edit");
    const r = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const project = r.value;
    const before = JSON.stringify(project);

    try {
      project.archive();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }

    const saved = await this.projects.update(project);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.archived",
      entityType: "project",
      entityId: projectId,
      projectId,
      oldValue: before,
      newValue: JSON.stringify(project),
    });
    return { ok: true, value: undefined };
  }
}
