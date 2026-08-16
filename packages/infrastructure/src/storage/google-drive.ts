import type { IEvidenceStorage, SaveEvidenceInput, EvidenceLocation } from "@donordesk/application";
import { DomainError, type Result } from "@donordesk/domain";
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

/**
 * Reference-based evidence storage: files stay in the tenant's own Google Drive.
 * No bytes are copied into DonorDesk. `save()` grants the DonorDesk service
 * account read access and records the driveFileId + web link. The tenant must
 * have an OAuth connection configured (via onboarding) before use.
 */
export class GoogleDriveEvidenceStorage implements IEvidenceStorage {
  readonly provider = "GOOGLE_DRIVE" as const;

  constructor(private readonly tokens: GoogleDriveAccessTokenStore) {}

  async save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>> {
    const config = await this.tokens.getAccessToken(input.tenantId);
    if (!config) return fail("Google Drive is not connected for this tenant");
    if (!input.driveFileId) return fail("Google Drive evidence requires a drive file id");

    try {
      const accessToken = await this.refreshAccessToken(config);
      const file = await this.getFile(accessToken, input.driveFileId);
      // Grant the DonorDesk service account read access so files can be read
      // for OCR / export without requiring the end user's presence.
      await this.grantReadAccess(accessToken, input.driveFileId, config.shareEmail);

      return ok({
        provider: "GOOGLE_DRIVE",
        fileUrl: file.webViewLink ?? `https://drive.google.com/file/d/${input.driveFileId}/view`,
        fileSize: file.size ?? input.fileSize,
        driveFileId: input.driveFileId,
        driveWebLink: file.webViewLink ?? undefined,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Google Drive link failed");
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
    // Reference-only: we never copy or own the bytes, so there is nothing to
    // delete. Ownership stays with the tenant's Google Drive.
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
