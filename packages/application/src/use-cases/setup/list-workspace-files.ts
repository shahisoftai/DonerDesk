import type { Result, DomainError } from "@donordesk/domain";
import { DomainError as DE } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectWorkspaceService, DriveFileEntry } from "../../ports/infrastructure.js";
import type { IProjectRepository } from "../../ports/projects.js";

export const WORKSPACE_FOLDER_LABELS: Record<string, string> = {
  "01-Donor-Templates": "Donor templates",
  "02-Logframe": "Logframe",
  "03-Data-Files": "Data files",
  "04-Evidence-Reports": "Evidence reports",
  "05-Evidence-Images": "Evidence images",
  "06-Financial": "Financial",
  "07-Submitted-Reports": "Submitted reports",
};

export interface WorkspaceFolderFiles {
  role: string;
  label: string;
  files: DriveFileEntry[];
}

export interface ListWorkspaceFilesView {
  folders: WorkspaceFolderFiles[];
  deepLink?: string;
}

/**
 * Lists the current files inside one or more project workspace folder roles
 * (Google Drive folders or the local mirror). Listing first ensures the
 * project workspace exists (idempotent), so a brand-new Drive connection or a
 * project that has never been provisioned is reconciled on demand. Each page
 * load (including after login) and every manual "refresh" re-runs this, so
 * files added directly in Drive are picked up.
 */
export class ListWorkspaceFilesHandler {
  constructor(
    private readonly workspace: IProjectWorkspaceService,
    private readonly projects: IProjectRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, roles: string[]): Promise<Result<ListWorkspaceFilesView, DomainError>> {
    const projectResult = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DE.notFound("Project", projectId) };

    const workspaceResult = await this.workspace.ensureProjectWorkspace(ctx.tenant.tenantId, projectId);
    if (!workspaceResult.ok) return workspaceResult;

    const folders: WorkspaceFolderFiles[] = [];
    for (const role of [...new Set(roles)]) {
      const listResult = await this.workspace.listProjectFolderFiles(ctx.tenant.tenantId, projectId, role);
      if (!listResult.ok) return listResult;
      folders.push({ role, label: WORKSPACE_FOLDER_LABELS[role] ?? role, files: listResult.value });
    }

    return { ok: true, value: { folders, deepLink: workspaceResult.value.deepLink } };
  }
}
