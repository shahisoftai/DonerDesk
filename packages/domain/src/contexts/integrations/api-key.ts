/**
 * API keys (Phase 33.7): a long random token an organisation gives to another system so it can read its
 * data. Only the SHA-256 of the token is ever stored (as SCIM credentials and share links do); the token
 * itself is shown once. A key is read-only, limited to named scopes and, optionally, named projects, and
 * can expire or be revoked. Pure: randomness and the clock are passed in.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const API_KEY_PREFIX = "dd_live_";

/** What a key may read. Every scope is read-only in this version. */
export const API_SCOPES = ["projects:read", "indicators:read", "places:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABEL: Readonly<Record<ApiScope, string>> = {
  "projects:read": "The list of projects",
  "indicators:read": "Indicator values, by period",
  "places:read": "Results by place",
};

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === "string" && (API_SCOPES as readonly string[]).includes(value);
}

export interface NewApiToken {
  /** Shown to the person once; never stored. */
  token: string;
  /** The first characters, shown in the key list so a key can be recognised. */
  prefix: string;
  tokenHash: string;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** `randomBytes` is injected so the generator is deterministic in tests. */
export function newApiToken(randomBytes: (n: number) => Buffer): NewApiToken {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, API_KEY_PREFIX.length + 6), tokenHash: hashApiToken(token) };
}

/** The token in an `Authorization: Bearer …` header, or undefined when the header is absent or is not one of ours. */
export function bearerApiToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token, extra] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined) return undefined;
  return token.startsWith(API_KEY_PREFIX) && token.length >= API_KEY_PREFIX.length + 40 ? token : undefined;
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export interface ApiKeyState {
  scopes: readonly ApiScope[];
  /** Empty = every project of the organisation. */
  projectIds: readonly string[];
  expiresAt?: Date | undefined;
  revokedAt?: Date | undefined;
}

export type ApiKeyRefusal = "REVOKED" | "EXPIRED" | "SCOPE" | "PROJECT";

/** Whether a key may do this now. The refusal names why (the route answers 401/403 without leaking more). */
export function checkApiKey(key: ApiKeyState, need: { scope: ApiScope; projectId?: string }, now: Date): ApiKeyRefusal | null {
  if (key.revokedAt) return "REVOKED";
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (!key.scopes.includes(need.scope)) return "SCOPE";
  if (need.projectId && key.projectIds.length > 0 && !key.projectIds.includes(need.projectId)) return "PROJECT";
  return null;
}
