import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { buildServer } = await import("../dist/server.js");
const { JwtAuthProvider } = await import("@donordesk/infrastructure");

test("foundation health and Prometheus endpoints respond", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, "ok");
  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.body, /donordesk_http_requests_total/);
});

test("ping requires authentication and returns tenant context", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const denied = await app.inject({ method: "GET", url: "/v1/ping" });
  assert.equal(denied.statusCode, 401);
  const token = await new JwtAuthProvider().sign({
    sub: "user-1", tid: "tenant-a", role: "ADMIN", name: "Admin", email: "admin@example.org",
  }, 60);
  const response = await app.inject({ method: "GET", url: "/v1/ping", headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-tenant-id"], "tenant-a");
  assert.equal(response.json().tenantId, "tenant-a");
});

test("sensitive read routes enforce RBAC before repository access", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const token = await new JwtAuthProvider().sign({
    sub: "viewer-1", tid: "tenant-a", role: "VIEWER", name: "Viewer", email: "viewer@example.org",
  }, 60);
  const headers = { authorization: `Bearer ${token}` };

  const users = await app.inject({ method: "GET", url: "/v1/users", headers });
  assert.equal(users.statusCode, 403);
  const audit = await app.inject({ method: "GET", url: "/v1/audit-log", headers });
  assert.equal(audit.statusCode, 403);
  const exports = await app.inject({ method: "GET", url: "/v1/projects/project-1/exports", headers });
  assert.equal(exports.statusCode, 403);
});
