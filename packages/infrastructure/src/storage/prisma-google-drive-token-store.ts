import type { GoogleDriveStorageConfig, GoogleDriveAccessTokenStore } from "./google-drive.js";
import type { PrismaGoogleDriveCredentialStore } from "./google-drive-credentials.js";

/**
 * Per-tenant Google Drive token store for evidence storage. Reads the
 * per-tenant refresh token from PrismaGoogleDriveCredentialStore (set during
 * OAuth onboarding) and merges it with the shared OAuth client config from
 * env vars (GOOGLE_DRIVE_CLIENT_ID / _SECRET / _SHARE_EMAIL).
 */
export class PrismaGoogleDriveTokenStore implements GoogleDriveAccessTokenStore {
  constructor(private readonly credentials: PrismaGoogleDriveCredentialStore) {}

  async getAccessToken(tenantId: string): Promise<GoogleDriveStorageConfig | null> {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const shareEmail = process.env.GOOGLE_DRIVE_SHARE_EMAIL ?? "";
    if (!clientId || !clientSecret) return null;

    const result = await this.credentials.find(tenantId);
    if (!result.ok || !result.value) return null;
    return {
      clientId,
      clientSecret,
      refreshToken: result.value.refreshToken,
      shareEmail,
    };
  }
}
