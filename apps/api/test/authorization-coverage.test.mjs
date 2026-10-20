import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { buildServer } = await import("../dist/server.js");
const { RULES } = await import("../dist/middleware/authorization.js");

/**
 * Turns a Fastify route pattern into a concrete path so a rule's RegExp can
 * be tested against it: `:name` becomes a sample segment and `:name(a|b)`
 * becomes the first alternative.
 */
function samplePath(url) {
  return url
    .replace(/:[A-Za-z0-9_]+\(([^)]*)\)/g, (_match, alternatives) => alternatives.split("|")[0])
    .replace(/:[A-Za-z0-9_]+/g, "sample")
    .replace(/\*/g, "sample");
}

test("every route in the authenticated scope has an authorisation rule", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());

  const scoped = app.scopedRoutes;
  assert.ok(scoped.length > 100, `expected the authenticated scope to hold the API routes, found ${scoped.length}`);

  const uncovered = [];
  for (const route of scoped) {
    // Fastify serves HEAD for every GET route; HEAD is the same request
    // without a body and carries the same permission.
    const method = route.method.toUpperCase() === "HEAD" ? "GET" : route.method.toUpperCase();
    const path = samplePath(route.url);
    const matched = RULES.some((rule) => rule.method === method && rule.route.test(path));
    if (!matched) uncovered.push(`${route.method.toUpperCase()} ${route.url}`);
  }

  assert.deepEqual(
    uncovered,
    [],
    `these routes are registered in the authenticated scope but have no rule in apps/api/src/middleware/authorization.ts.\n` +
      `The table is exhaustive by construction: a route with no rule is refused. Add a rule for each one.`,
  );
});

test("a route with no rule is refused rather than allowed", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());

  const { JwtAuthProvider } = await import("@donordesk/infrastructure");
  const token = await new JwtAuthProvider().sign({
    sub: "admin-1", tid: "tenant-a", role: "ADMIN", name: "Admin", email: "admin@example.org",
  }, 60);

  // /v1/ping is registered outside the authenticated scope, so it never reaches
  // the authorisation middleware. A signed-in caller on a path the table does
  // not describe is refused with 403 rather than served.
  const response = await app.inject({
    method: "GET",
    url: "/v1/does-not-exist",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 404);
});
