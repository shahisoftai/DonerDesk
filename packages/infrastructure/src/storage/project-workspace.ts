import { mkdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import type { IProjectWorkspaceService, WorkspaceReference } from "@donordesk/application";
import { DomainError } from "@donordesk/domain";
import type { TenantId, StorageProvider, Result } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

/** Stable folder roles under a project workspace root. */
export const PROJECT_WORKSPACE_FOLDERS = [
  "01-Donor-Templates",
  "02-Logframe",
  "03-Data-Files",
  "04-Evidence-Reports",
  "05-Evidence-Images",
  "06-Financial",
  "07-Submitted-Reports",
] as const;

export interface ProjectWorkspaceNameProvider {
  projectLabel(projectId: string, tenantId: TenantId): Promise<string>;
  tenantLabel(tenantId: TenantId): Promise<string>;
}

/**
 * LOCAL/R2 provider workspace: mirrors the Drive folder tree under the storage
 * root. Provisioning is effectively free (mkdir), so it is marked NOT_REQUIRED
 * for readiness but still scaffolds a real directory for byte storage.
 */
export class LocalProjectWorkspaceService implements IProjectWorkspaceService {
  constructor(
    private readonly storageRoot: string,
    private readonly names: ProjectWorkspaceNameProvider,
  ) {}

  async ensureTenantRoot(tenantId: TenantId): Promise<Result<WorkspaceReference, DomainError>> {
    const label = await this.names.tenantLabel(tenantId);
    const root = resolve(this.storageRoot, "workspaces", this.safe(label));
    await mkdir(root, { recursive: true });
    return ok({ provider: "LOCAL", rootId: root });
  }

  async ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    const label = await this.names.projectLabel(projectId, tenantId);
    const root = join(tenant.value.rootId, this.safe(label));
    await mkdir(root, { recursive: true });
    const subfolders = [];
    for (const role of PROJECT_WORKSPACE_FOLDERS) {
      const dir = join(root, role);
      await mkdir(dir, { recursive: true });
      subfolders.push({ role, id: dir });
    }
    return ok({ provider: "LOCAL", rootId: root, subfolders });
  }

  async verifyAccess(): Promise<Result<void, DomainError>> {
    return ok(undefined);
  }

  async repairProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    return this.ensureProjectWorkspace(tenantId, projectId);
  }

  private safe(label: string): string {
    return label.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 100) || "untitled";
  }
}

/**
 * GOOGLE_DRIVE provider workspace: reference-only folder tree in the tenant's
 * own Drive. Uses stable appProperties identities so provisioning is idempotent
 * and repairable; never recreates a folder identity on rename.
 */
export class GoogleDriveProjectWorkspaceService implements IProjectWorkspaceService {
  constructor(
    private readonly names: ProjectWorkspaceNameProvider,
    private readonly drive: {
      ensureRoot(tenantId: TenantId): Promise<Result<{ id: string; deepLink?: string }, DomainError>>;
      ensureFolder(input: {
        parentId: string;
        name: string;
        role: string;
        tenantId: string;
        projectId: string;
      }): Promise<Result<{ id: string }, DomainError>>;
      verifyAccess(rootId: string): Promise<Result<void, DomainError>>;
    },
  ) {}

  async ensureTenantRoot(tenantId: TenantId): Promise<Result<WorkspaceReference, DomainError>> {
    const root = await this.drive.ensureRoot(tenantId);
    if (!root.ok) return root;
    return ok({ provider: "GOOGLE_DRIVE", rootId: root.value.id, deepLink: root.value.deepLink });
  }

  async ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    const label = await this.names.projectLabel(projectId, tenantId);
    const projectRoot = await this.drive.ensureFolder({
      parentId: tenant.value.rootId,
      name: label,
      role: "PROJECT_ROOT",
      tenantId: tenantId.toString(),
      projectId,
    });
    if (!projectRoot.ok) return projectRoot;

    const subfolders = [];
    for (const role of PROJECT_WORKSPACE_FOLDERS) {
      const folder = await this.drive.ensureFolder({
        parentId: projectRoot.value.id,
        name: role,
        role,
        tenantId: tenantId.toString(),
        projectId,
      });
      if (!folder.ok) return folder;
      subfolders.push({ role, id: folder.value.id });
    }
    return ok({ provider: "GOOGLE_DRIVE", rootId: projectRoot.value.id, subfolders });
  }

  async verifyAccess(tenantId: TenantId, rootId: string): Promise<Result<void, DomainError>> {
    return this.drive.verifyAccess(rootId);
  }

  async repairProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    return this.ensureProjectWorkspace(tenantId, projectId);
  }
}

/** Resolves the per-tenant workspace provider strategy. */
export interface ProjectWorkspaceProviderResolver {
  resolve(tenantId: TenantId): Promise<Result<{ provider: StorageProvider }, DomainError>>;
}

export { ok as workspaceOk, fail as workspaceFail };
