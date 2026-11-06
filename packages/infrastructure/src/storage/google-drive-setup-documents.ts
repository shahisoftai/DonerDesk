/**
 * Where a project document lives (Phase 36): the organisation's own Google Drive, never DonorDesk's servers. The bytes pass
 * through memory while they are sent to Drive and read back, and are not kept. Before the project exists the file sits in a
 * staging folder in the organisation's DonorDesk Drive folder; once the project is created it moves into the project's own
 * "00-Project-Documents" folder. Everything here is a file or folder the app itself created, which is all the connection's
 * `drive.file` permission allows.
 */
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IDriveFileContentReader, IProjectWorkspaceService, ISetupDocumentStore, MovedSetupDocument, StagedSetupDocument } from "@donordesk/application";
import type { GoogleDriveAccessTokenStore } from "./google-drive.js";
import type { GoogleDriveWorkspaceDrive } from "./google-drive-workspace.js";

export const SETUP_STAGING_ROLE = "SETUP_STAGING";
export const SETUP_STAGING_NAME = "Project setup (documents in progress)";
export const PROJECT_DOCUMENTS_ROLE = "00-Project-Documents";
/** Google refuses the saved permission (revoked, or expired): only the person can grant it again. */
const DRIVE_RECONNECT = "Your Google Drive connection has expired. Go to Settings, open Storage and connect Google Drive again, then add the documents again.";

const SETUP_SOURCE_ROLE = "SETUP_SOURCE";

const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const fail = (message: string): Result<never, DomainError> => ({ ok: false, error: new DomainError("INVARIANT_VIOLATION", message) });

export class GoogleDriveSetupDocuments implements ISetupDocumentStore {
  constructor(
    private readonly tokens: GoogleDriveAccessTokenStore,
    private readonly drive: GoogleDriveWorkspaceDrive,
    private readonly workspace: IProjectWorkspaceService,
    private readonly reader: IDriveFileContentReader,
  ) {}

  async available(tenantId: TenantId): Promise<boolean> {
    return (await this.tokens.getAccessToken(tenantId.toString())) !== null;
  }

  async stage(tenantId: TenantId, doc: { name: string; mimeType: string; bytes: Buffer }): Promise<Result<StagedSetupDocument, DomainError>> {
    const staging = await this.stagingFolder(tenantId);
    if (!staging.ok) return /oauth refresh failed|invalid_grant/i.test(staging.error.message) ? fail(DRIVE_RECONNECT) : staging;
    const uploaded = await this.drive.uploadFile({ tenantId: tenantId.toString(), parentId: staging.value, name: doc.name, mimeType: doc.mimeType, bytes: doc.bytes, role: SETUP_SOURCE_ROLE });
    if (!uploaded.ok) return fail("The document could not be saved to your Google Drive. Check that Drive is still connected in Settings and try again.");
    return ok({ fileId: uploaded.value.id, ...(uploaded.value.webViewLink ? { webLink: uploaded.value.webViewLink } : {}) });
  }

  async read(tenantId: TenantId, fileId: string) {
    return this.reader.read(tenantId, fileId);
  }

  async moveToProject(tenantId: TenantId, fileId: string, projectId: string): Promise<Result<MovedSetupDocument, DomainError>> {
    const workspace = await this.workspace.ensureProjectWorkspace(tenantId, projectId);
    if (!workspace.ok) return workspace;
    const folder = workspace.value.subfolders?.find((f) => f.role === PROJECT_DOCUMENTS_ROLE);
    if (!folder) return fail("The project's documents folder is not set up yet.");
    const moved = await this.drive.moveFile(tenantId.toString(), fileId, folder.id);
    if (!moved.ok) return moved;
    const info = await this.drive.fileInfo(tenantId.toString(), fileId);
    return ok({ folder: PROJECT_DOCUMENTS_ROLE, ...(info.ok && info.value.name ? { name: info.value.name } : {}), ...(info.ok && info.value.webViewLink ? { webLink: info.value.webViewLink } : {}) });
  }

  async removeStaged(tenantId: TenantId, fileId: string): Promise<Result<void, DomainError>> {
    const staging = await this.stagingFolder(tenantId);
    if (!staging.ok) return staging;
    const info = await this.drive.fileInfo(tenantId.toString(), fileId);
    if (!info.ok) return ok(undefined); // already gone
    // Only a file still in the staging folder is ours to remove: anything the person moved is left alone.
    if (!info.value.parents.includes(staging.value)) return ok(undefined);
    return this.drive.trashFile(tenantId.toString(), fileId);
  }

  private async stagingFolder(tenantId: TenantId): Promise<Result<string, DomainError>> {
    const root = await this.workspace.ensureTenantRoot(tenantId);
    if (!root.ok) return root;
    const folder = await this.drive.ensureTenantFolder({ tenantId: tenantId.toString(), parentId: root.value.rootId, name: SETUP_STAGING_NAME, role: SETUP_STAGING_ROLE });
    return folder.ok ? ok(folder.value.id) : folder;
  }
}
