import { mkdir, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { IProjectWorkspaceService, WorkspaceReference, DriveFileEntry, OrganisationFoldersResult } from "@donordesk/application";
import { ok, DomainError } from "@donordesk/domain";
import { ORGANISATION_FOLDERS, PROJECTS_FOLDER_ROLE } from "./organisation-folders.js";
import type { TenantId, StorageProvider, Result } from "@donordesk/domain";

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  csv: "text/csv",
  txt: "text/plain",
};

function mimeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/** Stable folder roles under a project workspace root. */
export const PROJECT_WORKSPACE_FOLDERS = [
  "00-Project-Documents",
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

  async ensureOrganisationFolders(tenantId: TenantId): Promise<Result<OrganisationFoldersResult, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    const dirs = new Map<string, string>();
    const folders: OrganisationFoldersResult["folders"] = [];
    for (const folder of ORGANISATION_FOLDERS) {
      const dir = join(folder.parent ? dirs.get(folder.parent)! : tenant.value.rootId, folder.name);
      let created = false;
      try {
        await stat(dir);
      } catch {
        created = true;
      }
      await mkdir(dir, { recursive: true });
      dirs.set(folder.role, dir);
      folders.push({ role: folder.role, name: folder.name, id: dir, created });
    }
    return ok({ rootId: tenant.value.rootId, folders });
  }

  async ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    const label = await this.names.projectLabel(projectId, tenantId);
    const root = join(tenant.value.rootId, "03-Projects", this.safe(label));
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

  async listProjectFolderFiles(tenantId: TenantId, projectId: string, role: string): Promise<Result<DriveFileEntry[], DomainError>> {
    const workspace = await this.ensureProjectWorkspace(tenantId, projectId);
    if (!workspace.ok) return workspace;
    const folder = workspace.value.subfolders?.find((f) => f.role === role);
    if (!folder) return ok([]);
    try {
      const entries = await readdir(folder.id, { withFileTypes: true });
      const files: DriveFileEntry[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const meta = await stat(join(folder.id, entry.name));
        files.push({
          id: `${role}/${entry.name}`,
          name: entry.name,
          mimeType: mimeFor(entry.name),
          size: meta.size,
          modifiedTime: meta.mtime.toISOString(),
        });
      }
      files.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
      return ok(files);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Local workspace file list failed");
    }
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
      ensureTenantFolderStrict(input: { tenantId: string; parentId: string; name: string; role: string }): Promise<Result<{ id: string; created: boolean }, DomainError>>;
      fileInfo(tenantId: string, fileId: string): Promise<Result<{ parents: string[] }, DomainError>>;
      moveFile(tenantId: string, fileId: string, toFolderId: string): Promise<Result<void, DomainError>>;
      verifyAccess(rootId: string): Promise<Result<void, DomainError>>;
      listFiles(tenantId: string, folderId: string): Promise<Result<DriveFileEntry[], DomainError>>;
    },
  ) {}

  async ensureTenantRoot(tenantId: TenantId): Promise<Result<WorkspaceReference, DomainError>> {
    const root = await this.drive.ensureRoot(tenantId);
    if (!root.ok) return root;
    return ok({ provider: "GOOGLE_DRIVE", rootId: root.value.id, deepLink: root.value.deepLink });
  }

  // Folder identities are stable, and ensuring them costs about nine Drive calls: remember a successful result for a while
  // (and share one in-flight run) so listing a folder does not rebuild the tree every time. A failed listing clears it.
  private readonly ensured = new Map<string, { expires: number; run: Promise<Result<WorkspaceReference, DomainError>> }>();
  private static readonly ENSURE_TTL_MS = 10 * 60 * 1000;

  async ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    const key = `${tenantId.toString()}:${projectId}`;
    const hit = this.ensured.get(key);
    if (hit && hit.expires > Date.now()) return hit.run;
    const run = this.buildProjectWorkspace(tenantId, projectId);
    this.ensured.set(key, { expires: Date.now() + GoogleDriveProjectWorkspaceService.ENSURE_TTL_MS, run });
    const result = await run;
    if (!result.ok) this.ensured.delete(key);
    return result;
  }

  // Setting folders up is one run per organisation at a time: a second click joins the first instead of racing it.
  private readonly organisationRuns = new Map<string, Promise<Result<OrganisationFoldersResult, DomainError>>>();

  /**
   * Creates the organisation folder tree in the tenant's Drive. Every folder is found by its role first, so running it
   * again (or after the folders already exist) creates nothing; a lookup Drive cannot answer stops the run.
   */
  ensureOrganisationFolders(tenantId: TenantId): Promise<Result<OrganisationFoldersResult, DomainError>> {
    const key = tenantId.toString();
    const running = this.organisationRuns.get(key);
    if (running) return running;
    const run = this.buildOrganisationFolders(tenantId).finally(() => this.organisationRuns.delete(key));
    this.organisationRuns.set(key, run);
    return run;
  }

  private async buildOrganisationFolders(tenantId: TenantId): Promise<Result<OrganisationFoldersResult, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    const ids = new Map<string, string>();
    const folders: OrganisationFoldersResult["folders"] = [];
    for (const folder of ORGANISATION_FOLDERS) {
      const parentId = folder.parent ? ids.get(folder.parent) : tenant.value.rootId;
      if (!parentId) return fail(`The folder "${folder.name}" has no parent to sit in.`);
      const ensured = await this.drive.ensureTenantFolderStrict({ tenantId: tenantId.toString(), parentId, name: folder.name, role: folder.role });
      if (!ensured.ok) return ensured;
      ids.set(folder.role, ensured.value.id);
      folders.push({ role: folder.role, name: folder.name, id: ensured.value.id, created: ensured.value.created });
    }
    return ok({ rootId: tenant.value.rootId, deepLink: tenant.value.deepLink, folders });
  }

  private async buildProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    const tenant = await this.ensureTenantRoot(tenantId);
    if (!tenant.ok) return tenant;
    // Project trees live under "03-Projects"; the organisation tree is made on the way if it is not there yet.
    const organisation = await this.ensureOrganisationFolders(tenantId);
    if (!organisation.ok) return organisation;
    const projectsFolder = organisation.value.folders.find((f) => f.role === PROJECTS_FOLDER_ROLE);
    if (!projectsFolder) return fail("The Projects folder is not set up yet.");
    const label = await this.names.projectLabel(projectId, tenantId);
    const projectRoot = await this.drive.ensureFolder({
      parentId: projectsFolder.id,
      name: label,
      role: "PROJECT_ROOT",
      tenantId: tenantId.toString(),
      projectId,
    });
    if (!projectRoot.ok) return projectRoot;
    // A project tree made before "03-Projects" existed sits beside it: move it in (a tree already there is left alone).
    const moved = await this.drive.moveFile(tenantId.toString(), projectRoot.value.id, projectsFolder.id);
    if (!moved.ok) return moved;

    const folders = await Promise.all(
      PROJECT_WORKSPACE_FOLDERS.map(async (role) => ({
        role,
        folder: await this.drive.ensureFolder({ parentId: projectRoot.value.id, name: role, role, tenantId: tenantId.toString(), projectId }),
      })),
    );
    const subfolders = [];
    for (const { role, folder } of folders) {
      if (!folder.ok) return folder;
      subfolders.push({ role, id: folder.value.id });
    }
    return ok({ provider: "GOOGLE_DRIVE", rootId: projectRoot.value.id, subfolders });
  }

  async verifyAccess(tenantId: TenantId, rootId: string): Promise<Result<void, DomainError>> {
    return this.drive.verifyAccess(rootId);
  }

  async repairProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>> {
    this.ensured.delete(`${tenantId.toString()}:${projectId}`);
    return this.ensureProjectWorkspace(tenantId, projectId);
  }

  async listProjectFolderFiles(tenantId: TenantId, projectId: string, role: string): Promise<Result<DriveFileEntry[], DomainError>> {
    const workspace = await this.ensureProjectWorkspace(tenantId, projectId);
    if (!workspace.ok) return workspace;
    const folder = workspace.value.subfolders?.find((f) => f.role === role);
    if (!folder) return ok([]);
    const listed = await this.drive.listFiles(tenantId.toString(), folder.id);
    if (!listed.ok) {
      // A folder removed or replaced in Drive makes the remembered ids stale: rebuild once.
      this.ensured.delete(`${tenantId.toString()}:${projectId}`);
      const again = await this.ensureProjectWorkspace(tenantId, projectId);
      const fresh = again.ok ? again.value.subfolders?.find((f) => f.role === role) : undefined;
      return fresh && fresh.id !== folder.id ? this.drive.listFiles(tenantId.toString(), fresh.id) : listed;
    }
    return listed;
  }
}

/** Resolves the per-tenant workspace provider strategy. */
export interface ProjectWorkspaceProviderResolver {
  resolve(tenantId: TenantId): Promise<Result<{ provider: StorageProvider }, DomainError>>;
}

export { ok as workspaceOk, fail as workspaceFail };
