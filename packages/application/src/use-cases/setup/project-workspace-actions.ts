import { DomainError } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import { ProjectWorkspaceProvisionRequested } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectWorkspaceService, WorkspaceReference } from "../../ports/infrastructure.js";
import type { IProjectSetupRepository } from "../../ports/setup.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IAuditLogger, IEventBus } from "../../ports/core.js";

export interface WorkspaceActionResult {
  reference: WorkspaceReference | null;
  provisionStatus: string;
  error?: string;
}

/**
 * Retries an idempotent workspace provision. Safe to call repeatedly; the
 * underlying service reconciles rather than recreates.
 */
export class RetryProjectWorkspaceHandler {
  constructor(
    private readonly workspace: IProjectWorkspaceService,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<WorkspaceActionResult, DomainError>> {
    const projectResult = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const setupResult = await this.setup.ensureForProject(projectId, ctx.tenant.tenantId);
    if (!setupResult.ok) return setupResult;
    const setup = setupResult.value;

    if (setup.workspaceProvisionStatus === "NOT_REQUIRED") {
      return {
        ok: true,
        value: { reference: null, provisionStatus: "NOT_REQUIRED" },
      };
    }

    // Provision in-process for the configured provider; record event for async
    // reconciliation (Kestra/BullMQ) regardless.
    setup.beginProvision();
    await this.setup.update(setup);
    await this.events.publish([new ProjectWorkspaceProvisionRequested(ctx.tenant.tenantId, projectId)]);

    const result = await this.workspace.ensureProjectWorkspace(ctx.tenant.tenantId, projectId);
    if (!result.ok) {
      setup.markFailed(result.error.message);
      const saved = await this.setup.update(setup);
      if (!saved.ok) return saved;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "project.workspace.provision_failed",
        entityType: "project",
        entityId: projectId,
        projectId,
        newValue: JSON.stringify({ error: result.error.message }),
      });
      return {
        ok: true,
        value: { reference: null, provisionStatus: "FAILED", error: result.error.message },
      };
    }

    setup.markReady();
    const saved = await this.setup.update(setup);
    if (!saved.ok) return saved;
    projectResult.value.setWorkspaceRoot(result.value.rootId);
    await this.projects.update(projectResult.value);

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.workspace.provisioned",
      entityType: "project",
      entityId: projectId,
      projectId,
      newValue: JSON.stringify({ rootId: result.value.rootId, deepLink: result.value.deepLink }),
    });

    return { ok: true, value: { reference: result.value, provisionStatus: "READY" } };
  }
}

/**
 * Verifies and repairs the project workspace tree (idempotent).
 */
export class RepairProjectWorkspaceHandler {
  constructor(
    private readonly workspace: IProjectWorkspaceService,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<WorkspaceActionResult, DomainError>> {
    const projectResult = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const setupResult = await this.setup.ensureForProject(projectId, ctx.tenant.tenantId);
    if (!setupResult.ok) return setupResult;
    const setup = setupResult.value;

    if (setup.workspaceProvisionStatus === "NOT_REQUIRED") {
      return { ok: true, value: { reference: null, provisionStatus: "NOT_REQUIRED" } };
    }

    const result = await this.workspace.repairProjectWorkspace(ctx.tenant.tenantId, projectId);
    if (!result.ok) return result;

    setup.markReady();
    const saved = await this.setup.update(setup);
    if (!saved.ok) return saved;
    projectResult.value.setWorkspaceRoot(result.value.rootId);
    await this.projects.update(projectResult.value);

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.workspace.repaired",
      entityType: "project",
      entityId: projectId,
      projectId,
      newValue: JSON.stringify({ rootId: result.value.rootId }),
    });

    return { ok: true, value: { reference: result.value, provisionStatus: "READY" } };
  }
}
