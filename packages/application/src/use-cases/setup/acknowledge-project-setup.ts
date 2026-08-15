import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectSetupRepository } from "../../ports/setup.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ProjectReadiness } from "../../ports/projects.js";

export interface AcknowledgeProjectSetupResult {
  acknowledged: boolean;
  readiness: ProjectReadiness;
}

/**
 * Records optional user acknowledgement of setup completion. Acknowledgement is
 * NOT a gate; readiness is derived automatically and can regress to
 * ACTION_REQUIRED even after acknowledgement.
 */
export class AcknowledgeProjectSetupHandler {
  constructor(
    private readonly setup: IProjectSetupRepository,
    private readonly readinessService: {
      compute(projectId: string, tenantId: import("@donordesk/domain").TenantId): Promise<Result<ProjectReadiness, DomainError>>;
    },
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    projectId: string,
  ): Promise<Result<AcknowledgeProjectSetupResult, DomainError>> {
    const setupResult = await this.setup.ensureForProject(projectId, ctx.tenant.tenantId);
    if (!setupResult.ok) return setupResult;
    const setup = setupResult.value;

    setup.acknowledge(ctx.tenant.userId);
    const saved = await this.setup.update(setup);
    if (!saved.ok) return saved;

    const readinessResult = await this.readinessService.compute(projectId, ctx.tenant.tenantId);
    if (!readinessResult.ok) return readinessResult;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.setup.acknowledged",
      entityType: "project_setup",
      entityId: setup.id,
      projectId,
      newValue: JSON.stringify({ ready: readinessResult.value.ready, status: readinessResult.value.status }),
    });

    return { ok: true, value: { acknowledged: true, readiness: readinessResult.value } };
  }
}
