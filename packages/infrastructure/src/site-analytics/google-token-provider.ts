import { createSign } from "node:crypto";
import { StatsSourceUnavailable } from "@donordesk/application";
import type { IAccessTokenProvider } from "./google-ports.js";
import type { ServiceAccountKey } from "./service-account.js";

const LIFETIME_SECONDS = 3600;
const RENEW_BEFORE_SECONDS = 120;

const b64 = (value: object): string => Buffer.from(JSON.stringify(value)).toString("base64url");

interface Held {
  token: string;
  expiresAt: number;
}

/** Exchanges the service account's signed assertion for an access token and keeps it until shortly before it expires. */
export class GoogleTokenProvider implements IAccessTokenProvider {
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly loadKey: () => Promise<ServiceAccountKey>,
    private readonly fetcher: typeof fetch,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  async token(scopes: readonly string[]): Promise<string> {
    const scope = [...scopes].sort().join(" ");
    const now = this.nowSeconds();
    const held = this.held.get(scope);
    if (held && held.expiresAt - RENEW_BEFORE_SECONDS > now) return held.token;
    const key = await this.loadKey();
    const head = b64({ alg: "RS256", typ: "JWT" });
    const claim = b64({ iss: key.clientEmail, scope, aud: key.tokenUri, iat: now, exp: now + LIFETIME_SECONDS });
    const signature = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key.privateKey, "base64url");
    let response: Response;
    try {
      response = await this.fetcher(key.tokenUri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${signature}` }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new StatsSourceUnavailable("Google could not be reached.");
    }
    const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!response.ok || typeof body.access_token !== "string") throw new StatsSourceUnavailable("Google did not accept the service account key.");
    this.held.set(scope, { token: body.access_token, expiresAt: now + (typeof body.expires_in === "number" ? body.expires_in : LIFETIME_SECONDS) });
    return body.access_token;
  }
}
