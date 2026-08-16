import type { GoogleDriveStorageConfig, GoogleDriveAccessTokenStore } from "./google-drive.js";

/**
 * Resolves per-tenant Google Drive OAuth credentials for the evidence storage
 * adapter. In Phase C these will be read from the tenant-scoped CONNECTOR
 * configuration (PlatformConfiguration, encrypted via the control plane) set
 * during onboarding. For now they come from environment configuration so the
 * adapter can be exercised and wired before the onboarding flow lands.
 */
export class EnvGoogleDriveTokenStore implements GoogleDriveAccessTokenStore {
  constructor(private readonly overrides?: { tenantId?: string }) {}

  async getAccessToken(tenantId: string): Promise<GoogleDriveStorageConfig | null> {
    if (this.overrides?.tenantId && this.overrides.tenantId !== tenantId) return null;
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const shareEmail = process.env.GOOGLE_DRIVE_SHARE_EMAIL;
    if (!clientId || !clientSecret || !refreshToken) return null;
    return { clientId, clientSecret, refreshToken, shareEmail: shareEmail ?? "" };
  }
}
