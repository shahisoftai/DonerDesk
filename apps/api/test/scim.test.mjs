import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

const { registerScimRoutes, parseBasicAuth } = await import("../dist/scim/routes.js");

/**
 * The SCIM contract: a per-organisation bearer token, the standard discovery
 * endpoints, and the user list with its `userName eq` filter.
 */
const USERS = [
  { id: "u1", email: "a@example.org", name: "Ada Lovelace", role: "FIELD_OFFICER", active: true },
  { id: "u2", email: "b@example.org", name: "Bob Brown", role: "ME_OFFICER", active: false },
];

function buildApp(options = {}) {
  const app = Fastify();
  const seen = [];
  registerScimRoutes(app, {
    authenticate: async (token) => (token === "valid-token-value-that-is-long-enough" ? "tenant-a" : null),
    listUsers: async (tenantId) => {
      seen.push(tenantId);
      return USERS;
    },
    createUser: async (tenantId, input) => {
      seen.push(`create:${tenantId}:${input.email}`);
      return { id: "u3" };
    },
    updateUser: async (tenantId, userId, input) => {
      seen.push(`update:${tenantId}:${userId}:${input.active}`);
    },
    deleteUser: async (tenantId, userId) => {
      seen.push(`delete:${tenantId}:${userId}`);
    },
    ...options,
  });
  return { app, seen };
}

const auth = (token) => ({ authorization: `Basic ${Buffer.from(`scim:${token}`).toString("base64")}` });
const GOOD = auth("valid-token-value-that-is-long-enough");

test("a request without credentials is refused", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/scim/v2/Users" });
  assert.equal(response.statusCode, 401);
});

test("a request with an unknown token is refused", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/scim/v2/Users", headers: auth("wrong-token") });
  assert.equal(response.statusCode, 401);
});

test("a short token is refused", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/scim/v2/Users", headers: auth("short") });
  assert.equal(response.statusCode, 401);
});

test("a valid token lists the organisation's users", async (t) => {
  const { app, seen } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/scim/v2/Users", headers: GOOD });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.totalResults, 2);
  assert.equal(body.Resources[0].userName, "a@example.org");
  assert.equal(body.Resources[0].active, true);
  assert.equal(body.Resources[1].active, false);
  assert.deepEqual(seen, ["tenant-a"], "the tenant comes from the credential, not the request");
});

test("the userName filter narrows the list", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/scim/v2/Users?filter=${encodeURIComponent('userName eq "b@example.org"')}`,
    headers: GOOD,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().totalResults, 1);
  assert.equal(response.json().Resources[0].userName, "b@example.org");
});

test("an unsupported filter is refused in plain words", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/scim/v2/Users?filter=${encodeURIComponent('displayName sw "a"')}`,
    headers: GOOD,
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().detail, /filter/i);
});

test("a user is created for the credential's organisation", async (t) => {
  const { app, seen } = buildApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/scim/v2/Users",
    headers: GOOD,
    payload: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "c@example.org", name: { givenName: "Cara", familyName: "Cole" } },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, "u3");
  assert.ok(seen.includes("create:tenant-a:c@example.org"));
});

test("a user is deactivated and removed through the standard verbs", async (t) => {
  const { app, seen } = buildApp();
  t.after(() => app.close());
  const put = await app.inject({
    method: "PUT",
    url: "/scim/v2/Users/u1",
    headers: GOOD,
    payload: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "a@example.org", name: { givenName: "Ada", familyName: "Lovelace" }, active: false },
  });
  assert.equal(put.statusCode, 200);
  assert.ok(seen.includes("update:tenant-a:u1:false"));

  const del = await app.inject({ method: "DELETE", url: "/scim/v2/Users/u1", headers: GOOD });
  assert.equal(del.statusCode, 204);
  assert.ok(seen.includes("delete:tenant-a:u1"));
});

test("the discovery endpoints describe the service", async (t) => {
  const { app } = buildApp();
  t.after(() => app.close());
  const config = await app.inject({ method: "GET", url: "/scim/v2/ServiceProviderConfig", headers: GOOD });
  assert.equal(config.statusCode, 200);
  assert.ok(config.json().schemas.includes("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"));
  const types = await app.inject({ method: "GET", url: "/scim/v2/ResourceTypes", headers: GOOD });
  assert.equal(types.json().Resources[0].endpoint, "/scim/v2/Users");
  const schemas = await app.inject({ method: "GET", url: "/scim/v2/Schemas", headers: GOOD });
  assert.equal(schemas.json().Resources[0].name, "User");
});

test("the SCIM hook does not guard the other routes", async (t) => {
  // The SCIM authentication hook lives in its own context. A hook on the root
  // instance would have made every route on the server answer 401.
  const { app } = buildApp();
  t.after(() => app.close());
  app.get("/health", async () => ({ status: "ok" }));
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
});

test("basic auth is parsed the standard way", () => {
  assert.deepEqual(parseBasicAuth(`Basic ${Buffer.from("scim:secret").toString("base64")}`), { user: "scim", pass: "secret" });
  assert.equal(parseBasicAuth("Bearer abc"), null);
  assert.equal(parseBasicAuth("Basic"), null);
});
