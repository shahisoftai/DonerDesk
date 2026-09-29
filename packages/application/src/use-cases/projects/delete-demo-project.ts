import { DomainError } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IDemoProjectRepository } from "../../ports/demo.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Feature 22 (DonorDesk Academy): permanently removes the tenant's demo
 * project and everything seeded under it. Refuses to touch a real project —
 * `isDemo` must be true — so this can never become a backdoor around the
 * still-deferred general project-deletion feature.
 */
export class DeleteDemoProjectHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly demo: IDemoProjectRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<void, DomainError>> {
    const found = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    if (!found.value.isDemo) {
      return { ok: false, error: DomainError.forbidden("Only demo projects can be deleted this way") };
    }

    const deleted = await this.demo.deleteDemoProjectData(ctx.tenant.tenantId, projectId);
    if (!deleted.ok) return deleted;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.demo.deleted",
      entityType: "project",
      entityId: projectId,
      projectId,
      oldValue: found.value.title,
    });
    return { ok: true, value: undefined };
  }
}
