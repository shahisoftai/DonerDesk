/**
 * Pictures a person uploads for dashboards and infographics (Phase 61.8) live in the organisation's own Google Drive, in a folder the
 * app made (`07-Visual-Media`), never on DonorDesk's servers and with no fallback to them: when Drive is not connected the upload is
 * refused and says what to do. A stored picture is named by `drive:<tenantId>:<fileId>`; keys from before this change (server storage)
 * are still read from there. The bytes pass through memory and are not kept.
 */
import { DomainError, TenantId, type Result } from "@donordesk/domain";
import type { IDriveFileContentReader, IMediaStore, IProjectWorkspaceService, IStorage, StoragePutInput, StoragePutResult } from "@donordesk/application";
import type { GoogleDriveAccessTokenStore } from "./google-drive.js";
import type { GoogleDriveWorkspaceDrive } from "./google-drive-workspace.js";

export const VISUAL_MEDIA_ROLE = "VISUAL_MEDIA";
export const VISUAL_MEDIA_NAME = "07-Visual-Media";
const MEDIA_FILE_ROLE = "VISUAL_MEDIA_FILE";
const DRIVE_PREFIX = "drive:";
const DRIVE_RECONNECT = "Your Google Drive is not connected, so the picture could not be saved. Go to Settings, open Storage and connect Google Drive, then upload it again.";

const fail = (message: string): Result<never, DomainError> => ({ ok: false, error: new DomainError("INVARIANT_VIOLATION", message) });
export const driveMediaKey = (tenantId: string, fileId: string): string => `${DRIVE_PREFIX}${tenantId}:${fileId}`;
export function parseDriveMediaKey(key: string): { tenantId: string; fileId: string } | null {
  if (!key.startsWith(DRIVE_PREFIX)) return null;
  const rest = key.slice(DRIVE_PREFIX.length);
  const i = rest.indexOf(":");
  return i > 0 && i < rest.length - 1 ? { tenantId: rest.slice(0, i), fileId: rest.slice(i + 1) } : null;
}

export class GoogleDriveMediaStore implements IMediaStore {
  constructor(
    private readonly tokens: GoogleDriveAccessTokenStore,
    private readonly drive: GoogleDriveWorkspaceDrive,
    private readonly workspace: IProjectWorkspaceService,
  ) {}

  async put(tenantId: TenantId, file: { name: string; contentType: string; bytes: Buffer }): Promise<Result<{ storageKey: string; webLink?: string }, DomainError>> {
    if ((await this.tokens.getAccessToken(tenantId.toString())) === null) return fail(DRIVE_RECONNECT);
    const root = await this.workspace.ensureTenantRoot(tenantId);
    if (!root.ok) return /oauth refresh failed|invalid_grant/i.test(root.error.message) ? fail(DRIVE_RECONNECT) : root;
    const folder = await this.drive.ensureTenantFolder({ tenantId: tenantId.toString(), parentId: root.value.rootId, name: VISUAL_MEDIA_NAME, role: VISUAL_MEDIA_ROLE });
    if (!folder.ok) return folder;
    const uploaded = await this.drive.uploadFile({ tenantId: tenantId.toString(), parentId: folder.value.id, name: file.name, mimeType: file.contentType, bytes: file.bytes, role: MEDIA_FILE_ROLE });
    if (!uploaded.ok) return fail("The picture could not be saved to your Google Drive. Check that Drive is still connected in Settings and try again.");
    return { ok: true, value: { storageKey: driveMediaKey(tenantId.toString(), uploaded.value.id), ...(uploaded.value.webViewLink ? { webLink: uploaded.value.webViewLink } : {}) } };
  }
}

/** Reads a picture by its key: from the organisation's Drive for a `drive:` key, from the older storage for any other. Writing and the rest go to the older storage unchanged. */
export class DriveRoutingStorage implements IStorage {
  constructor(private readonly legacy: IStorage, private readonly reader: IDriveFileContentReader) {}
  put(input: StoragePutInput): Promise<StoragePutResult> { return this.legacy.put(input); }
  getSignedUrl(key: string, ttlSeconds: number): Promise<string> { return this.legacy.getSignedUrl(key, ttlSeconds); }
  remove(key: string): Promise<void> { return parseDriveMediaKey(key) ? Promise.resolve() : this.legacy.remove(key); }
  async read(key: string): Promise<Buffer> {
    const parsed = parseDriveMediaKey(key);
    if (!parsed) return this.legacy.read(key);
    const r = await this.reader.read(TenantId.create(parsed.tenantId), parsed.fileId);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.bytes;
  }
}
