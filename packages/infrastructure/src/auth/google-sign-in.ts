import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IGoogleSignInConnector } from "@donordesk/application";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/**
 * Google Sign-In connector used at the login page. Exchanges the OAuth
 * authorization code for a token response and verifies the returned ID token
 * against Google's public keys before the user is provisioned a session.
 *
 * Shares the Google Cloud OAuth client with the Drive onboarding connector
 * (GOOGLE_DRIVE_CLIENT_ID / _SECRET) but uses its own redirect URI, so the
 * same Google Cloud project can serve both flows.
 */
export class GoogleSignInConnector implements IGoogleSignInConnector {
  private readonly jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

  private get clientId(): string {
    const value = process.env.GOOGLE_DRIVE_CLIENT_ID ?? process.env.GOOGLE_AUTH_CLIENT_ID;
    if (!value) throw new Error("GOOGLE_DRIVE_CLIENT_ID is required for Google Sign-In");
    return value;
  }

  private get clientSecret(): string {
    const value = process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? process.env.GOOGLE_AUTH_CLIENT_SECRET;
    if (!value) throw new Error("GOOGLE_DRIVE_CLIENT_SECRET is required for Google Sign-In");
    return value;
  }

  private get redirectUri(): string {
    const value = process.env.GOOGLE_AUTH_REDIRECT_URI ?? `${process.env.APP_URL ?? ""}/api/auth/google/callback`;
    if (!value) throw new Error("GOOGLE_AUTH_REDIRECT_URI is required for Google Sign-In");
    return value;
  }

  async exchangeCode(code: string): Promise<{ email: string; name: string; googleSubject: string }> {
    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status})`);
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) throw new Error("Google did not return an ID token");

    return await this.verifyIdToken(tokens.id_token);
  }

  private async verifyIdToken(idToken: string): Promise<{ email: string; name: string; googleSubject: string }> {
    let payload: { email?: string; name?: string; email_verified?: boolean; sub?: string };
    try {
      const result = await jwtVerify(idToken, this.jwks, {
        issuer: [...GOOGLE_ISSUERS],
        audience: this.clientId,
      });
      payload = result.payload as typeof payload;
    } catch {
      throw new Error("Google ID token verification failed");
    }

    if (!payload.sub) throw new Error("Google ID token is missing a subject");
    if (!payload.email || payload.email_verified !== true) throw new Error("Google account email is not verified");
    return {
      email: payload.email,
      name: payload.name ?? payload.email,
      googleSubject: payload.sub,
    };
  }
}
