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

// Phase 36 (AI project setup wizard) SOLID guards, plan §3: the setup code stays small, one class per file, and no file
// outside the SETUP_AREAS registry branches on an area name — a new area is one row plus its registered tools, never a
// new `if`. Only the wizard's own directories are scanned (the older setup-checklist feature owns the other "setup" files).
const SETUP_DIRS = [
  "packages/domain/src/contexts/project-setup",
  "packages/application/src/use-cases/project-setup",
  "packages/infrastructure/src/project-setup",
];
const SETUP_FILES = ["packages/contracts/src/project-setup.ts"];

function setupSources() {
  const out = [];
  for (const dir of SETUP_DIRS) {
    try { statSync(join(ROOT, dir)); } catch { continue; }
    out.push(...sourceFiles(join(ROOT, dir)));
  }
  for (const file of SETUP_FILES) {
    try { statSync(join(ROOT, file)); } catch { continue; }
    out.push(join(ROOT, file));
  }
  return out;
}

const AREA_BRANCH = /(===|!==)\s*("|')(FACTS|LOGFRAME|INDICATORS|PERIODS|PLAN|PLACES|FUNDING_BUDGET|RISKS)\2|case\s+("|')(FACTS|LOGFRAME|INDICATORS|PERIODS|PLAN|PLACES|FUNDING_BUDGET|RISKS)\4/;

test("project-setup files stay under 300 lines with at most one exported class (Phase 36 SOLID guard)", () => {
  const found = [];
  for (const file of setupSources()) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n").length;
    if (lines > 300) found.push(`${relative(ROOT, file)} has ${lines} lines (limit 300)`);
    const classes = [...text.matchAll(/^export\s+(?:default\s+)?(?:abstract\s+)?class\s+/gm)].length;
    if (classes > 1) found.push(`${relative(ROOT, file)} exports ${classes} classes (limit 1)`);
  }
  assert.deepEqual(found, []);
});

test("no project-setup file branches on an area name outside the SETUP_AREAS registry (Phase 36 open/closed guard)", () => {
  const found = [];
  for (const file of setupSources()) {
    if (file.endsWith("proposal-areas.ts")) continue;
    const text = readFileSync(file, "utf8");
    if (AREA_BRANCH.test(text)) found.push(`${relative(ROOT, file)} branches on an area name; add a SETUP_AREAS row instead`);
  }
  assert.deepEqual(found, []);
});

test("setup problem codes are the same list in the domain and the contracts (Phase 36 mirror pin)", () => {
  const codes = (text) => {
    const m = text.match(/SETUP_PROBLEM_CODES\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(m, "SETUP_PROBLEM_CODES list not found");
    return [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]);
  };
  const domain = codes(readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/proposal-checks.ts"), "utf8"));
  const contracts = codes(readFileSync(join(ROOT, "packages/contracts/src/project-setup.ts"), "utf8"));
  assert.ok(domain.length >= 10, "the domain list looks truncated");
  assert.deepEqual(contracts, domain);
});
