const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Exchanges a stored refresh token for a fresh access token. */
export async function refreshGoogleAccessToken(credentials: GoogleOAuthCredentials): Promise<string> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status})`);
  const data = (await response.json()) as { access_token: string };
  if (!data.access_token) throw new Error("Google OAuth response missing access_token");
  return data.access_token;
}

/** Extracts a spreadsheet id from a Google Sheets URL or a bare file id. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/[?&#]id=([a-zA-Z0-9_-]{10,})/);
  if (match?.[1]) return match[1];
  const pathMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch?.[1]) return pathMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}
