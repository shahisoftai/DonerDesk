import type { Result, DomainError } from "@donordesk/domain";
import { ProjectWorkspaceProvisionRequested } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectWorkspaceService } from "../../ports/infrastructure.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectSetupRepository } from "../../ports/setup.js";
import type { IAuditLogger, IEventBus } from "../../ports/core.js";

/**
 * Provisions the tenant "DonorDesk" root and every existing project workspace
 * after the tenant connects Google Drive (or after any storage change). Runs
 * in-process and is fully idempotent; failures on individual projects are
 * recorded but do not abort the connect. Ensures the folder tree the product
 * promises ("connect once, folders appear") exists immediately.
 */
export class ProvisionTenantWorkspacesHandler {
  constructor(
    private readonly workspace: IProjectWorkspaceService,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ provisioned: number }, DomainError>> {
    const rootResult = await this.workspace.ensureTenantRoot(ctx.tenant.tenantId);
    if (!rootResult.ok) return rootResult;

    const projectsResult = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!projectsResult.ok) return projectsResult;

    let provisioned = 0;
    for (const project of projectsResult.value) {
      const setupResult = await this.setup.ensureForProject(project.id, ctx.tenant.tenantId);
      if (!setupResult.ok) return setupResult;
      const setup = setupResult.value;
      if (setup.isWorkspaceReady()) continue;

      const workspaceResult = await this.workspace.ensureProjectWorkspace(ctx.tenant.tenantId, project.id);
      if (!workspaceResult.ok) {
        setup.markFailed(workspaceResult.error.message);
        await this.setup.update(setup);
        continue;
      }
      setup.markReady();
      await this.setup.update(setup);
      project.setWorkspaceRoot(workspaceResult.value.rootId);
      await this.projects.update(project);
      provisioned += 1;
    }

    await this.events.publish(
      projectsResult.value.map((p) => new ProjectWorkspaceProvisionRequested(ctx.tenant.tenantId, p.id)),
    );
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "storage.google_drive.provisioned",
      entityType: "organization",
      entityId: ctx.tenant.tenantId.toString(),
      newValue: JSON.stringify({ rootId: rootResult.value.rootId, provisioned }),
    });

    return { ok: true, value: { provisioned } };
  }
}
