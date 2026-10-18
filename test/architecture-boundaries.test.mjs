// Dependency-inversion guard (Phase 28 §2.5): the layers only point inwards.
// - domain imports nothing outside packages/domain (Node built-ins excepted: node:crypto for ids/tokens);
// - application imports domain, contracts and its own ports, never infrastructure, Prisma or Next;
// - web `features/*/domain` modules are pure: no React, no Next, no server code.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const IMPORT = /(?:^|\s)(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|mts)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path);
  }
  return out;
}

function importsOf(file) {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3]);
}

function violations(dir, isAllowed) {
  const found = [];
  for (const file of sourceFiles(join(ROOT, dir))) {
    for (const spec of importsOf(file)) if (!isAllowed(spec, file)) found.push(`${relative(ROOT, file)} imports ${spec}`);
  }
  return found;
}

test("domain imports nothing outside packages/domain", () => {
  const allowed = new Set(["node:crypto"]);
  assert.deepEqual(violations("packages/domain/src", (s) => s.startsWith(".") || allowed.has(s)), []);
});

test("application never imports infrastructure, Prisma or Next", () => {
  const banned = /^(@donordesk\/infrastructure|@prisma\/|prisma$|next(\/|$)|react(\/|$))/;
  assert.deepEqual(violations("packages/application/src", (s) => !banned.test(s)), []);
});

test("web feature domain modules are pure (no React, Next or server code)", () => {
  const featuresDir = join(ROOT, "apps/web/src/features");
  const banned = /^(react(\/|-dom|$)|next(\/|$)|server-only|@\/lib\/server|@donordesk\/infrastructure|@prisma\/)/;
  const found = [];
  for (const feature of readdirSync(featuresDir)) {
    const dir = join("apps/web/src/features", feature, "domain");
    try { statSync(join(ROOT, dir)); } catch { continue; }
    found.push(...violations(dir, (s) => !banned.test(s)));
  }
  assert.deepEqual(found, []);
});
