import { DomainError, Permissions, err, ok, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IProjectRepository } from "../../ports/projects.js";

/** Admin-only: show or hide the work plan screens of a project. Hiding keeps the data; showing brings it back unchanged. */
export class SetWorkPlanningVisibilityHandler {
  constructor(private readonly projects: IProjectRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, projectId: string, show: boolean): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return err(DomainError.forbidden("Only an admin can change this"));
    const found = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Project", projectId));
    const project = found.value;
    if (project.showWorkPlanning === show) return ok(undefined);
    project.setWorkPlanningVisible(show);
    const saved = await this.projects.update(project);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.work_planning_visibility_changed",
      entityType: "project", entityId: projectId, projectId, oldValue: String(!show), newValue: String(show),
    });
    return ok(undefined);
  }
}
