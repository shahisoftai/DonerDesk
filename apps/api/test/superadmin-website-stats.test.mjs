import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerWebsiteStatsRoutes } from "../dist/routes/superadmin-website-stats.js";

async function app(env) {
  const server = Fastify();
  registerWebsiteStatsRoutes(server, env);
  await server.ready();
  return server;
}

test("with nothing set up the report answers 200 and names each missing part", async () => {
  const server = await app({});
  const res = await server.inject({ method: "GET", url: "/superadmin/website-stats?days=7" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.range, 7);
  assert.equal(body.traffic.status, "NOT_CONFIGURED");
  assert.equal(body.search.status, "NOT_CONFIGURED");
  await server.close();
});

test("an unknown range reads 28 days and the key file path never appears in the answer", async () => {
  const server = await app({ GOOGLE_STATS_SERVICE_ACCOUNT_FILE: "/opt/secret/key.json", GA4_PROPERTY_ID: "1", SEARCH_CONSOLE_SITE: "x" });
  const res = await server.inject({ method: "GET", url: "/superadmin/website-stats?days=abc" });
  assert.equal(res.json().range, 28);
  assert.ok(!res.body.includes("/opt/secret"));
  await server.close();
});

test("the route is part of the Superadmin secured scope in superadmin.ts", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/routes/superadmin.ts", import.meta.url), "utf8");
  assert.match(source, /registerWebsiteStatsRoutes\(secured\)/);
});
