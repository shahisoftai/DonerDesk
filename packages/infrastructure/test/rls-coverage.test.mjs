import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The row-level-security list and the Prisma schema drift apart silently: a
 * model is added to schema.prisma, no one remembers to add it to rls.sql, and
 * the table quietly has no tenant policy. This test is the thing that stops
 * that — it reads both files and requires every tenant-scoped model to be
 * named in one of them.
 *
 * It also checks the opposite direction: a table in the policy list that no
 * longer exists in the schema would make rls.sql fail at apply time.
 */

const here = dirname(fileURLToPath(import.meta.url));
// test/ -> package root -> packages/ -> repo root
const packageRoot = resolve(here, "..");
const repoRoot = resolve(packageRoot, "../..");
const schemaPath = join(packageRoot, "prisma/schema.prisma");
const rlsPath = join(repoRoot, "infra/postgres/rls.sql");

function readModels(schema) {
  const models = new Map();
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    models.set(match[1], match[2]);
  }
  return models;
}

function readPolicyTables(rls) {
  const block = rls.match(/FOREACH table_name IN ARRAY ARRAY\[([\s\S]*?)\] LOOP/);
  assert.ok(block, "rls.sql no longer has a FOREACH table_name IN ARRAY block");
  return [...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
}

function readGlobalTables(rls) {
  // Tables granted to the runtime role outside the tenant-isolation loop.
  const global = new Set();
  const tail = rls.slice(rls.indexOf("END $$;"));
  for (const match of tail.matchAll(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "(\w+)"/g)) {
    global.add(match[1]);
  }
  return global;
}

test("every tenant-scoped model is either policy-protected or a named global table", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const rls = readFileSync(rlsPath, "utf8");
  const models = readModels(schema);
  const policy = new Set(readPolicyTables(rls));
  const global = readGlobalTables(rls);

  const tenantModels = [...models.entries()]
    .filter(([, body]) => /^\s*tenantId\s+String\??/m.test(body))
    .map(([name]) => name);

  assert.ok(tenantModels.length > 60, `expected many tenant-scoped models, found ${tenantModels.length}`);

  const unprotected = tenantModels.filter((name) => !policy.has(name) && !global.has(name));
  assert.deepEqual(
    unprotected,
    [],
    `these models carry a tenantId but are in neither the rls.sql policy list nor the global-tables block.\n` +
      `Either add them to the FOREACH array in infra/postgres/rls.sql, or grant them explicitly as a global table\n` +
      `and say why they are not tenant-isolated.`,
  );
});

test("the policy list contains no table the schema does not define", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const rls = readFileSync(rlsPath, "utf8");
  const models = readModels(schema);
  const unknown = readPolicyTables(rls).filter((name) => !models.has(name));
  assert.deepEqual(
    unknown,
    [],
    "these tables are in the rls.sql policy list but are not models in schema.prisma; rls.sql would fail to apply",
  );
});

test("a table is not both policy-protected and global", () => {
  const rls = readFileSync(rlsPath, "utf8");
  const both = readPolicyTables(rls).filter((name) => readGlobalTables(rls).has(name));
  assert.deepEqual(both, [], "a table cannot be tenant-isolated and global at the same time");
});

test("BillingEventInbox stays a documented global table", () => {
  const rls = readFileSync(rlsPath, "utf8");
  const global = readGlobalTables(rls);
  assert.ok(
    global.has("BillingEventInbox"),
    "BillingEventInbox has a nullable tenantId (the tenant is resolved after the provider event arrives), so it " +
      "cannot carry a tenant_isolation policy. It must be granted explicitly as a global table instead.",
  );
  assert.ok(
    !readPolicyTables(rls).includes("BillingEventInbox"),
    "BillingEventInbox must not be in the tenant-isolation policy list: a null tenantId would make every " +
      "unresolved event invisible to every session, including the one that has to recover it.",
  );
});
