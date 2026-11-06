import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { buildServer } = await import("../dist/server.js");
const { JwtAuthProvider } = await import("@donordesk/infrastructure");

// These routes sit outside the authenticated scope, so they build their own tenant container (once forgot: 500 in production).
test("own-account routes have a tenant container (no 'handlers of undefined')", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const token = await new JwtAuthProvider().sign({ sub: "00000000-0000-4000-8000-000000000001", tid: "00000000-0000-4000-8000-000000000002", role: "ADMIN", name: "A", email: "a@example.org" }, 60);
  const headers = { authorization: `Bearer ${token}` };
  for (const url of ["/v1/auth/mfa"]) {
    const res = await app.inject({ method: "GET", url, headers });
    assert.notEqual(res.statusCode, 500, `${url}: ${res.body}`);
  }
  const res = await app.inject({ method: "POST", url: "/v1/auth/password/change", headers, payload: { currentPassword: "x", newPassword: "y" } });
  assert.notEqual(res.statusCode, 500, res.body);
});
