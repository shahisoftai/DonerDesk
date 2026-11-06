/**
 * Outbound webhooks (Phase 33.7): tell another system that something happened. The payload carries ids and
 * a status, never report text or restricted evidence; the receiver fetches details with its own API key.
 * Every request is signed (HMAC-SHA256 over `timestamp.body`), delivered with exponential retry, and an
 * endpoint that keeps failing is switched off. The address is checked so a webhook cannot be aimed at the
 * organisation's own network. Pure: the clock and the resolver are passed in.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export const WEBHOOK_EVENTS = [
  "report.approved",
  "report.submitted",
  "period.locked",
  "indicator.value.verified",
  "evidence.verified",
  "activity.accepted",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABEL: Readonly<Record<WebhookEvent, string>> = {
  "report.approved": "A report is approved",
  "report.submitted": "A report is submitted to the donor",
  "period.locked": "A reporting period is locked",
  "indicator.value.verified": "An indicator value is verified",
  "evidence.verified": "A piece of evidence is verified",
  "activity.accepted": "A completed activity is accepted",
};

export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export const WEBHOOK_MAX_ATTEMPTS = 8;
/** After this many deliveries in a row ending in failure the endpoint is switched off. */
export const WEBHOOK_DISABLE_AFTER_FAILED_DELIVERIES = 10;
export const WEBHOOK_TIMEOUT_MS = 8_000;

/** The signature header value: `t=<unix seconds>,v1=<hex hmac>`. */
export function signWebhook(secret: string, timestampSeconds: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");
  return `t=${timestampSeconds},v1=${mac}`;
}

/** For receivers and for tests: true when the header matches the body and is no older than `toleranceSeconds`. */
export function verifyWebhookSignature(secret: string, header: string, body: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds || !parts.v1) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  const given = Buffer.from(parts.v1);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Seconds until attempt number `attempt` (1-based count of attempts already made): 30 s, 2 min, 8 min … capped at 6 h. */
export function webhookRetryDelaySeconds(attemptsMade: number): number {
  return Math.min(6 * 3600, 30 * 4 ** Math.max(0, attemptsMade - 1));
}

const PRIVATE_V4: Array<[number, number]> = [
  [0x0a000000, 8], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12], [0xc0a80000, 16], [0x64400000, 10], [0x00000000, 8], [0xc0000000, 24], [0xc6120000, 15], [0xe0000000, 4], [0xf0000000, 4],
];

function ipv4ToInt(ip: string): number | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return undefined;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return undefined;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

/** True for an address a webhook must never reach: loopback, private, link-local (cloud metadata), carrier-grade NAT, multicast, reserved. */
export function isPrivateAddress(ip: string): boolean {
  // An IPv4 address written inside IPv6 ("::ffff:10.0.0.1", which URL parsing turns into "::ffff:a00:1") is that IPv4 address.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  const spelled = mapped ? `${parseInt(mapped[1]!, 16) >> 8}.${parseInt(mapped[1]!, 16) & 255}.${parseInt(mapped[2]!, 16) >> 8}.${parseInt(mapped[2]!, 16) & 255}` : ip.replace(/^::ffff:/i, "");
  const v4 = ipv4ToInt(spelled);
  if (v4 !== undefined) {
    return PRIVATE_V4.some(([base, bits]) => bits === 0 ? true : (v4 >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

/**
 * The address-shaped check that needs no network: https only, no credentials in the address, a real host name,
 * and not an address that is private by its spelling. The delivery runner repeats the private-address check on
 * the address the name actually resolves to (a name can point inward), and never follows a redirect.
 */
export function checkWebhookUrl(raw: string): Result<URL, DomainError> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return err(DomainError.validation("That is not a web address", { field: "url" }));
  }
  if (url.protocol !== "https:") return err(DomainError.validation("The address must start with https://", { field: "url" }));
  if (url.username || url.password) return err(DomainError.validation("The address must not contain a user name or password", { field: "url" }));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) return err(DomainError.validation("Use a full host name (for example hooks.example.org)", { field: "url" }));
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return err(DomainError.validation("That address points inside a private network; use a public address", { field: "url" }));
  }
  if (isPrivateAddress(host)) return err(DomainError.validation("That address points inside a private network; use a public address", { field: "url" }));
  return ok(url);
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  occurredAt: string;
  tenant: string;
  /** Ids and a status only — never text. */
  data: Record<string, string | number | boolean | null>;
}

const TEXTY = /(narrative|summary|text|content|body|comment|note|title|name)$/i;

/** A payload may carry ids, counts and statuses; a field that looks like free text is refused so none ever leaves. */
export function checkWebhookData(data: Record<string, unknown>): Result<WebhookPayload["data"], DomainError> {
  const out: WebhookPayload["data"] = {};
  for (const [key, value] of Object.entries(data)) {
    if (TEXTY.test(key)) return err(DomainError.invariant(`A webhook must not carry text (${key}); send an id and let the receiver fetch it`));
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) return err(DomainError.invariant(`A webhook field must be a simple value (${key})`));
    if (typeof value === "string" && value.length > 120) return err(DomainError.invariant(`A webhook field is too long to be an id (${key})`));
    out[key] = value as string | number | boolean | null;
  }
  return ok(out);
}
