import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { buildServer } = await import("../dist/server.js");

test("password/change requires authentication", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/change",
    payload: { currentPassword: "OldPass!2024", newPassword: "NewPass!2026Secure" },
  });
  assert.equal(response.statusCode, 401);
});

test("password/change rejects missing Authorization header", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/change",
    payload: {},
  });
  assert.equal(response.statusCode, 401);
});

test("password/reset/request validates input schema", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/reset/request",
    payload: { email: "not-an-email" },
  });
  assert.equal(response.statusCode, 400);
});

test("password/reset/request rejects missing email", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/reset/request",
    payload: {},
  });
  assert.equal(response.statusCode, 400);
});

test("password/reset/validate returns false for missing token", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/v1/auth/password/reset/validate?token=" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().valid, false);
});

test("password/reset/validate returns false for too-short token (no DB hit)", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/v1/auth/password/reset/validate?token=abc" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().valid, false);
});

test("password/reset/confirm rejects weak new password", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/reset/confirm",
    payload: { token: "x".repeat(40), newPassword: "password" },
  });
  assert.equal(response.statusCode, 400);
});

test("password/reset/confirm rejects short token via schema", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/password/reset/confirm",
    payload: { token: "short", newPassword: "NewPass!2026Secure" },
  });
  assert.equal(response.statusCode, 400);
});

test("superadmin password reset endpoint requires SuperAdmin authentication", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const response = await app.inject({
    method: "PATCH",
    url: "/superadmin/users/some-user",
    payload: { password: "NewPass!2026Secure" },
  });
  assert.equal(response.statusCode, 401);
});
