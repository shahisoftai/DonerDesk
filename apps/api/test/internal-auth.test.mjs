import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
process.env.INTERNAL_TOKEN ??= "test-internal-token";
process.env.INTERNAL_HMAC_SECRET ??= "test-internal-hmac-secret";

const { buildServer } = await import("../dist/server.js");
const { signInternalRequest, canonicalInternalString } = await import("../dist/middleware/internal.js");

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function signedHeaders(overrides = {}) {
  const timestamp = String(nowSeconds());
  const path = overrides.path ?? "/internal/evidence/ev-1";
  const method = overrides.method ?? "GET";
  const body = overrides.body ?? "";
  const tenantId = overrides.tenantId ?? "tenant-a";
  const signature = signInternalRequest({ method, path, tenantId, timestamp, body, secret: "test-internal-hmac-secret" });
  return {
    "x-internal-token": "test-internal-token",
    "x-tenant-id": tenantId,
    "x-internal-timestamp": timestamp,
    "x-internal-signature": signature,
  };
}

test("internal routes reject requests with no credentials", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1" });
  assert.equal(res.statusCode, 401);
});

test("internal routes reject a wrong token", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const headers = { ...signedHeaders(), "x-internal-token": "wrong" };
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1", headers });
  assert.equal(res.statusCode, 401);
});

test("internal routes reject a missing signature", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const headers = { "x-internal-token": "test-internal-token", "x-tenant-id": "tenant-a", "x-internal-timestamp": String(nowSeconds()) };
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1", headers });
  assert.equal(res.statusCode, 401);
});

test("internal routes reject an invalid signature", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const headers = { ...signedHeaders(), "x-internal-signature": "AAAAinvalid" };
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1", headers });
  assert.equal(res.statusCode, 401);
});

test("internal routes reject a stale timestamp", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const stale = String(nowSeconds() - 3600);
  const signature = signInternalRequest({ method: "GET", path: "/internal/evidence/ev-1", tenantId: "tenant-a", timestamp: stale, body: "", secret: "test-internal-hmac-secret" });
  const headers = { "x-internal-token": "test-internal-token", "x-tenant-id": "tenant-a", "x-internal-timestamp": stale, "x-internal-signature": signature };
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1", headers });
  assert.equal(res.statusCode, 401);
});

test("a correctly signed GET passes authentication", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const res = await app.inject({ method: "GET", url: "/internal/evidence/ev-1", headers: signedHeaders() });
  assert.notEqual(res.statusCode, 401);
});

test("malformed JSON body is rejected without reaching the handler", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const res = await app.inject({
    method: "POST",
    url: "/internal/evidence/ev-1/tags",
    headers: { "content-type": "application/json", ...signedHeaders({ method: "POST", path: "/internal/evidence/ev-1/tags", body: "{bad" }) },
    payload: "{bad",
  });
  assert.ok(res.statusCode >= 400 && res.statusCode < 500);
});

test("canonicalInternalString and signInternalRequest agree", () => {
  const canonical = canonicalInternalString({ method: "GET", path: "/p", tenantId: "tenant-a", timestamp: "123", body: "" });
  assert.equal(canonical, "GET\n/p\ntenant-a\n123\n");
  const sig = signInternalRequest({ method: "GET", path: "/p", tenantId: "tenant-a", timestamp: "123", body: "", secret: "secret" });
  assert.equal(typeof sig, "string");
  assert.ok(sig.length > 0);
});
