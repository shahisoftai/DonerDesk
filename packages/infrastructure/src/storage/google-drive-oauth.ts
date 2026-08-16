import type { IGoogleDriveConnector, GoogleDriveOAuthConfig } from "@donordesk/application";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Google Drive OAuth connector. Uses the same env config as the evidence
 * storage adapter (GOOGLE_DRIVE_CLIENT_ID / _SECRET). Builds the consent URL
 * (read + share scopes only) and exchanges the authorization code for a refresh
 * token. In production the client id/secret come from the SuperAdmin platform
 * config; for now they are read from the environment.
 */
export class GoogleDriveOAuthConnector implements IGoogleDriveConnector {
  async getConfig(): Promise<GoogleDriveOAuthConfig | null> {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
      ],
    };
  }

  async buildAuthUrl(state: string): Promise<{ authUrl: string }> {
    const config = await this.getConfig();
    if (!config) return { authUrl: "" };
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return { authUrl: `${OAUTH_AUTH_URL}?${params.toString()}` };
  }

  async exchangeCode(code: string): Promise<{ refreshToken: string; email?: string }> {
    const config = await this.getConfig();
    if (!config) throw new Error("Google Drive OAuth is not configured");
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    });
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error(`Google OAuth token exchange failed (${response.status})`);
    const data = (await response.json()) as { refresh_token?: string; email?: string };
    if (!data.refresh_token) throw new Error("Google OAuth did not return a refresh token (offline access)");
    return { refreshToken: data.refresh_token, email: data.email };
  }
}
