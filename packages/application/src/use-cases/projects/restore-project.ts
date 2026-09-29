import { DomainError, Permissions } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { applyEntitlementLimit } from "../../services/entitlement-service.js";

export class RestoreProjectHandler {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<void, DomainError>> {
    // A restore is a management op on the project (and claims a new active-
    // project slot below), same permission as editing it — defense in depth
    // alongside the route-level authorization rule.
    Permissions.require(ctx.tenant.role as import("@donordesk/domain").Role, "project.edit");
    const r = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const project = r.value;
    const before = JSON.stringify(project);

    const entitlementResult = await this.entitlements.resolve({ tenantId: ctx.tenant.tenantId.toString() });
    if (!entitlementResult.ok) return entitlementResult;
    const limit = entitlementResult.value.limits.maxActiveProjects;
    if (limit !== null) {
      const usageResult = await this.entitlements.usageSnapshot({ tenantId: ctx.tenant.tenantId.toString() });
      if (!usageResult.ok) return usageResult;
      if (usageResult.value.activeProjects >= limit) {
        const enforced = await applyEntitlementLimit(
          this.audit,
          ctx.tenant.tenantId,
          ctx.tenant.userId,
          "PROJECTS",
          limit,
          usageResult.value.activeProjects,
        );
        if (!enforced.ok) return enforced;
      }
    }

    try {
      project.restore();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }

    const saved = await this.projects.update(project);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.restored",
      entityType: "project",
      entityId: projectId,
      projectId,
      oldValue: before,
      newValue: JSON.stringify(project),
    });
    return { ok: true, value: undefined };
  }
}
