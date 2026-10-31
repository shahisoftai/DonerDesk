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
    const tree = await this.workspace.ensureOrganisationFolders(ctx.tenant.tenantId);
    if (!tree.ok) return tree;

    const projectsResult = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!projectsResult.ok) return projectsResult;

    let provisioned = 0;
    for (const project of projectsResult.value) {
      const setupResult = await this.setup.ensureForProject(project.id, ctx.tenant.tenantId);
      if (!setupResult.ok) return setupResult;
      const setup = setupResult.value;
      // Skip only projects already provisioned. Projects created under a
      // previous (e.g. LOCAL) provider carry NOT_REQUIRED and must be
      // provisioned now that the tenant is on Google Drive.
      if (setup.workspaceProvisionStatus === "READY") continue;

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

/**
 * "Set up folders": creates the organisation folder tree in the tenant's Drive and puts every project's tree under
 * "03-Projects". Safe to press any number of times: folders are found by their stable identity, so nothing is copied
 * when the DonorDesk folder already holds them.
 */
export class SetupOrganisationFoldersHandler {
  constructor(
    private readonly workspace: IProjectWorkspaceService,
    private readonly projects: IProjectRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ created: number; existing: number; projectsChecked: number; deepLink?: string }, DomainError>> {
    const tree = await this.workspace.ensureOrganisationFolders(ctx.tenant.tenantId);
    if (!tree.ok) return tree;

    // Each project's own tree is ensured too: that is what moves one made before "03-Projects" existed into it.
    const projectsResult = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!projectsResult.ok) return projectsResult;
    for (const project of projectsResult.value) {
      const workspace = await this.workspace.ensureProjectWorkspace(ctx.tenant.tenantId, project.id);
      if (!workspace.ok) return workspace;
      project.setWorkspaceRoot(workspace.value.rootId);
      await this.projects.update(project);
    }

    const created = tree.value.folders.filter((f) => f.created).length;
    const existing = tree.value.folders.length - created;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "storage.organisation_folders.set_up",
      entityType: "organization",
      entityId: ctx.tenant.tenantId.toString(),
      newValue: JSON.stringify({ created, existing, projects: projectsResult.value.length }),
    });
    return { ok: true, value: { created, existing, projectsChecked: projectsResult.value.length, ...(tree.value.deepLink ? { deepLink: tree.value.deepLink } : {}) } };
  }
}
