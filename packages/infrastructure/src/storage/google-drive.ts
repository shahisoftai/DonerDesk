import { randomBytes } from "node:crypto";
import type { IEvidenceStorage, IProjectWorkspaceService, SaveEvidenceInput, EvidenceLocation } from "@donordesk/application";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import { refreshGoogleAccessToken } from "./google-oauth.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

export interface GoogleDriveStorageConfig {
  /** OAuth client id / secret and the tenant's refresh token, resolved per tenant. */
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Service-account email granted read access when linking a Drive file. */
  shareEmail: string;
}

export interface GoogleDriveAccessTokenStore {
  getAccessToken(tenantId: string): Promise<GoogleDriveStorageConfig | null>;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const EVIDENCE_FOLDER_ROLE = "04-Evidence-Reports";
const IMAGE_FOLDER_ROLE = "05-Evidence-Images";

function isImageFile(fileType: string, fileName: string): boolean {
  const type = fileType.toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (
    type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)
  );
}

function tenantIdFrom(input: { tenantId: string }): TenantId {
  return { toString: () => input.tenantId } as TenantId;
}

/**
 * Managed Google Drive evidence storage: uploaded bytes are written into the
 * project's provisioned Drive folder tree (DonorDesk/<project>/04-Evidence-
 * Reports or 05-Evidence-Images), and reference-only linking of an existing
 * Drive file is still supported. Files stay in the tenant's own Drive; no
 * bytes are copied into DonorDesk-managed storage.
 */
export class GoogleDriveEvidenceStorage implements IEvidenceStorage {
  readonly provider = "GOOGLE_DRIVE" as const;

  constructor(
    private readonly tokens: GoogleDriveAccessTokenStore,
    private readonly workspace?: IProjectWorkspaceService,
  ) {}

  async save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");

    try {
      const accessToken = await this.refreshAccessToken(config);

      if (input.driveFileId) {
        // Reference-only: the file already lives in the tenant's Drive.
        const file = await this.getFile(accessToken, input.driveFileId);
        await this.grantReadAccess(accessToken, input.driveFileId, config.shareEmail);
        return ok({
          provider: "GOOGLE_DRIVE",
          fileUrl: file.webViewLink ?? `https://drive.google.com/file/d/${input.driveFileId}/view`,
          fileSize: file.size ?? input.fileSize,
          driveFileId: input.driveFileId,
          driveWebLink: file.webViewLink ?? undefined,
        });
      }

      if (input.buffer) {
        // Managed upload: save the bytes into the project's Evidence folder.
        if (!input.projectId) return fail("projectId is required for a managed Google Drive upload");
        const projectId: string = input.projectId;
        const folder = await this.resolveEvidenceFolder({
          tenantId: input.tenantId,
          projectId,
          fileType: input.fileType,
          fileName: input.fileName,
        });
        if (!folder.ok) return folder;
        const uploaded = await this.uploadBytes(accessToken, {
          name: input.fileName,
          parentId: folder.value.folderId,
          mimeType: input.fileType,
          body: input.buffer,
          tenantId: input.tenantId,
          projectId,
        });
        await this.grantReadAccess(accessToken, uploaded.id, config.shareEmail);
        return ok({
          provider: "GOOGLE_DRIVE",
          fileUrl: uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
          fileSize: uploaded.size ?? input.buffer.length,
          driveFileId: uploaded.id,
          driveWebLink: uploaded.webViewLink ?? undefined,
        });
      }

      return fail("Google Drive evidence requires file bytes or a drive file id");
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive save failed");
    }
  }

  async resolveDownloadUrl(location: EvidenceLocation): Promise<string> {
    if (!location.driveFileId) return location.fileUrl;
    const config = await this.tokens.getAccessToken(""); // tenant id not needed for a direct link
    const accessToken = config ? await this.refreshAccessToken(config) : null;
    if (accessToken) {
      return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(location.driveFileId)}?alt=media&access_token=${encodeURIComponent(accessToken)}`;
    }
    return location.fileUrl;
  }

  async remove(): Promise<void> {
    // Managed Drive uploads live in the tenant's own Drive. Deleting the file
    // there would destroy the user's record of it; evidence removal is handled
    // at the record level (evidence can be rejected/archived).
  }

  private async resolveEvidenceFolder(input: {
    tenantId: string;
    projectId: string;
    fileType: string;
    fileName: string;
  }): Promise<Result<{ folderId: string }, DomainError>> {
    if (!this.workspace) return fail("Google Drive workspace is not configured");
    const workspace = await this.workspace.ensureProjectWorkspace(
      tenantIdFrom(input),
      input.projectId,
    );
    if (!workspace.ok) return workspace;
    const role = isImageFile(input.fileType, input.fileName) ? IMAGE_FOLDER_ROLE : EVIDENCE_FOLDER_ROLE;
    const folder = workspace.value.subfolders?.find((f) => f.role === role);
    if (!folder) return fail(`Project evidence folder (${role}) is not provisioned`);
    return ok({ folderId: folder.id });
  }

  private async uploadBytes(
    accessToken: string,
    input: {
      name: string;
      parentId: string;
      mimeType: string;
      body: Buffer;
      tenantId: string;
      projectId: string;
    },
  ): Promise<{ id: string; webViewLink?: string; size?: number }> {
    const metadata = JSON.stringify({
      name: input.name,
      parents: [input.parentId],
      appProperties: { tenantId: input.tenantId, projectId: input.projectId, role: "EVIDENCE_FILE" },
    });
    const { body, contentType } = buildMultipartUpload(metadata, input.body, input.mimeType);
    const response = await fetch(
      `${DRIVE_UPLOAD_API}?uploadType=multipart&supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
        },
        body,
      },
    );
    if (!response.ok) throw new Error(`Google Drive file upload failed (${response.status})`);
    return (await response.json()) as { id: string; webViewLink?: string; size?: number };
  }

  private async refreshAccessToken(config: GoogleDriveStorageConfig): Promise<string> {
    return refreshGoogleAccessToken({ clientId: config.clientId, clientSecret: config.clientSecret, refreshToken: config.refreshToken });
  }

  private async getFile(accessToken: string, fileId: string): Promise<{ webViewLink?: string; size?: number }> {
    const response = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=webViewLink,size`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Google Drive file lookup failed (${response.status})`);
    return (await response.json()) as { webViewLink?: string; size?: number };
  }

  private async grantReadAccess(accessToken: string, fileId: string, email: string): Promise<void> {
    if (!email) return;
    const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "reader",
        type: "user",
        emailAddress: email,
      }),
    });
    // 409 = permission already exists; treat as success.
    if (!response.ok && response.status !== 409) {
      throw new Error(`Google Drive permission grant failed (${response.status})`);
    }
  }
}

/**
 * Builds a `multipart/related` body for the Drive resumable-free upload: part 1
 * is the JSON metadata, part 2 is the raw media bytes. Matches the Drive API
 * multipart contract.
 */
export function buildMultipartUpload(metadata: string, media: Buffer, mimeType: string): { body: Buffer; contentType: string } {
  const boundary = `donordesk_${randomBytes(16).toString("hex")}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return { body: Buffer.concat([head, media, tail]), contentType: `multipart/related; boundary=${boundary}` };
}
