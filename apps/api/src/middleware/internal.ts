import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantId } from "@donordesk/domain";

/**
 * Internal service-to-service authentication for the /internal/* routes.
 *
 * A request is accepted only when ALL of the following hold:
 *   - `X-Internal-Token` matches INTERNAL_TOKEN (constant-time compare).
 *   - `X-Tenant-Id` is a syntactically valid tenant id.
 *   - `X-Internal-Timestamp` is a Unix epoch (seconds) within a recent window.
 *   - `X-Internal-Signature` is an HMAC-SHA256 over
 *     `METHOD\nPATH\nTENANT_ID\nTIMESTAMP\nBODY` using INTERNAL_HMAC_SECRET.
 *
 * This binds the caller to the exact route and payload (replay + tamper safe),
 * satisfying ADR 0001's "signed X-Tenant-Id header + HMAC" requirement.
 */

export const INTERNAL_TOKEN_HEADER = "x-internal-token";
export const INTERNAL_TENANT_HEADER = "x-tenant-id";
export const INTERNAL_TIMESTAMP_HEADER = "x-internal-timestamp";
export const INTERNAL_SIGNATURE_HEADER = "x-internal-signature";
export const INTERNAL_MAX_AGE_SECONDS = 300;
export const INTERNAL_ACTOR_ID = "system:kestra";
export const INTERNAL_ACTOR_ROLE = "ADMIN" as const;

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

function headerValue(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

export function canonicalInternalString(input: { method: string; path: string; tenantId: string; timestamp: string; body: string }): string {
  return [input.method, input.path, input.tenantId, input.timestamp, input.body].join("\n");
}

/** Produces the signature a caller must attach. Exposed so flows/tests can sign requests. */
export function signInternalRequest(input: { method: string; path: string; tenantId: string; timestamp: string; body?: string; secret: string }): string {
  const canonical = canonicalInternalString({ method: input.method, path: input.path, tenantId: input.tenantId, timestamp: input.timestamp, body: input.body ?? "" });
  return createHmac("sha256", input.secret).update(canonical).digest("base64");
}

function unauthorized(title: string, status = 401) {
  return { type: "https://donordesk/problems/unauthorized", title, status };
}

export async function internalAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const token = process.env.INTERNAL_TOKEN;
  const secret = process.env.INTERNAL_HMAC_SECRET;
  if (!token || !secret) {
    req.log.warn({}, "internal auth is not configured: set INTERNAL_TOKEN and INTERNAL_HMAC_SECRET");
    return reply.status(500).send({ type: "https://donordesk/problems/internal", title: "Internal auth is not configured", status: 500 });
  }

  const provided = headerValue(req, INTERNAL_TOKEN_HEADER);
  if (!provided || !safeEqual(provided, token)) {
    return reply.status(401).send(unauthorized("Invalid internal token"));
  }

  const tenantHeader = headerValue(req, INTERNAL_TENANT_HEADER);
  if (!tenantHeader || !/^[A-Za-z0-9_-]{3,128}$/.test(tenantHeader)) {
    return reply.status(401).send(unauthorized("Invalid or missing tenant"));
  }

  const timestamp = headerValue(req, INTERNAL_TIMESTAMP_HEADER);
  if (!timestamp || !/^\d{1,13}$/.test(timestamp)) {
    return reply.status(401).send(unauthorized("Invalid or missing timestamp"));
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > INTERNAL_MAX_AGE_SECONDS) {
    return reply.status(401).send(unauthorized("Request timestamp is stale"));
  }

  const signature = headerValue(req, INTERNAL_SIGNATURE_HEADER);
  if (!signature) {
    return reply.status(401).send(unauthorized("Missing signature"));
  }

  const expected = signInternalRequest({
    method: req.method,
    path: req.url.split("?")[0] ?? "/",
    tenantId: tenantHeader,
    timestamp,
    body: (req as FastifyRequest & { rawBody?: string }).rawBody ?? "",
    secret,
  });
  if (!safeEqual(signature, expected)) {
    return reply.status(401).send(unauthorized("Invalid signature"));
  }

  req.tenant = {
    tenantId: TenantId.create(tenantHeader),
    userId: INTERNAL_ACTOR_ID,
    role: INTERNAL_ACTOR_ROLE,
    email: "internal@donordesk.local",
    name: "Kestra Service",
  };
}
