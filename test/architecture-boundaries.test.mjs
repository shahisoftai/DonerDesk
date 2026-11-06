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

test("wizard operation kinds are the same list in the domain and the contracts (Phase 38 mirror pin)", () => {
  const kinds = (text, re) => {
    const m = text.match(re);
    assert.ok(m, "operation list not found");
    return [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
  };
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const fromContracts = kinds(contracts, /SETUP_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(fromDomain.length >= 10);
  assert.deepEqual(fromContracts, fromDomain);
  const schemaKinds = [...contracts.slice(0, contracts.indexOf("SetupResultOperationSchema")).matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort();
  assert.deepEqual(schemaKinds, fromDomain);
});

test("wizard result operation kinds are the same list in the domain and the contracts (Phase 38.3 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/result-operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const list = contracts.match(/SETUP_RESULT_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(list, "result operation list not found");
  const fromContracts = [...list[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(fromContracts, fromDomain);
  const block = contracts.slice(contracts.indexOf("SetupResultOperationSchema"), contracts.indexOf("SetupPlaceOperationSchema"));
  assert.deepEqual([...block.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort(), fromDomain);
});

test("wizard place operation kinds are the same list in the domain and the contracts (Phase 38.4 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/place-operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const list = contracts.match(/SETUP_PLACE_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(list, "place operation list not found");
  assert.deepEqual([...list[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort(), fromDomain);
  const block = contracts.slice(contracts.indexOf("SetupPlaceOperationSchema"), contracts.indexOf("SetupPlanOperationSchema"));
  assert.deepEqual([...block.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort(), fromDomain);
});

test("wizard plan operation kinds are the same list in the domain and the contracts (Phase 38.5 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/plan-operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const list = contracts.match(/SETUP_PLAN_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(list, "plan operation list not found");
  assert.deepEqual([...list[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort(), fromDomain);
  const block = contracts.slice(contracts.indexOf("SetupPlanOperationSchema"), contracts.indexOf("SetupFinanceOperationSchema"));
  assert.deepEqual([...block.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort(), fromDomain);
});

test("wizard finance operation kinds are the same list in the domain and the contracts (Phase 38.8 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/finance-operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const list = contracts.match(/SETUP_FINANCE_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(list, "finance operation list not found");
  assert.deepEqual([...list[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort(), fromDomain);
  const block = contracts.slice(contracts.indexOf("SetupFinanceOperationSchema"), contracts.indexOf("SetupRiskOperationSchema"));
  assert.deepEqual([...block.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort(), fromDomain);
});

test("wizard risk operation kinds are the same list in the domain and the contracts (Phase 38.9 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/project-setup/pcw/risk-operations.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/project-setup-draft.ts"), "utf8");
  const fromDomain = [...domain.matchAll(/\{ kind: "([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const list = contracts.match(/SETUP_RISK_OPERATION_KINDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(list, "risk operation list not found");
  assert.deepEqual([...list[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort(), fromDomain);
  const block = contracts.slice(contracts.indexOf("SetupRiskOperationSchema"));
  assert.deepEqual([...block.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map((x) => x[1]).sort(), fromDomain);
});

// ---- Phase 41: the interactive map (dependency inversion and single responsibility) --------------------------------------------
const MAPS = "apps/web/src/features/maps";
const MAP_LIBRARIES = /^(maplibre-gl|terra-draw|terra-draw-maplibre-gl-adapter|pmtiles|@protomaps\/basemaps)(\/|$)/;
const isUnder = (file, sub) => relative(join(ROOT, MAPS), file).startsWith(`${sub}/`);

test("only the map adapters import a map library (maplibre-gl, terra-draw, pmtiles, @protomaps/basemaps)", () => {
  const found = [];
  for (const file of sourceFiles(join(ROOT, "apps/web/src"))) {
    if (isUnder(file, "adapters") && file.includes(`${MAPS}/adapters/`)) continue;
    for (const spec of importsOf(file)) if (MAP_LIBRARIES.test(spec) && !spec.endsWith(".css")) found.push(`${relative(ROOT, file)} imports ${spec}`);
  }
  assert.deepEqual(found, []);
});

test("map screens reach adapters only through the composition file, never directly", () => {
  const found = [];
  for (const file of sourceFiles(join(ROOT, MAPS, "presentation"))) {
    for (const spec of importsOf(file)) if (/(^|\/)adapters\//.test(spec)) found.push(`${relative(ROOT, file)} imports ${spec}`);
  }
  assert.deepEqual(found, []);
});

test("map ports and map domain depend on nothing but themselves (ports are interfaces, domain is pure)", () => {
  const found = [];
  for (const sub of ["ports"]) {
    for (const file of sourceFiles(join(ROOT, MAPS, sub))) {
      for (const spec of importsOf(file)) if (!spec.startsWith(".")) found.push(`${relative(ROOT, file)} imports ${spec}`);
      if (/\bclass\s+\w+/.test(readFileSync(file, "utf8"))) found.push(`${relative(ROOT, file)} declares a class (a port is an interface)`);
    }
  }
  assert.deepEqual(found, []);
});

test("map files stay small and single-purpose: at most 300 lines, at most one class each", () => {
  const found = [];
  for (const file of sourceFiles(join(ROOT, MAPS))) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n").length;
    const classes = (text.match(/^export (?:default )?class\s/gm) ?? []).length;
    if (lines > 300) found.push(`${relative(ROOT, file)} has ${lines} lines`);
    if (classes > 1) found.push(`${relative(ROOT, file)} exports ${classes} classes`);
  }
  assert.deepEqual(found, []);
});

test("every map renderer, basemap and boundary source implements its port", () => {
  const expect = [
    ["adapters/maplibre/renderer.ts", "implements MapRenderer"],
    ["adapters/basemap/protomaps-basemap.ts", "implements BasemapSource"],
    ["adapters/boundaries/files-boundary-source.ts", "implements BoundarySource"],
    ["adapters/maplibre/pin-placer.ts", "implements PinPlacer"],
    ["adapters/maplibre/area-tool.ts", "implements DrawingTool"],
    ["adapters/boundaries/tenant-layer-boundary-source.ts", "implements BoundarySource"],
  ];
  for (const [file, clause] of expect) assert.ok(readFileSync(join(ROOT, MAPS, file), "utf8").includes(clause), `${file} must ${clause}`);
});

test("the ways a place can be located are the same list in the domain and the contracts (Phase 41.6 mirror pin)", () => {
  const domain = readFileSync(join(ROOT, "packages/domain/src/contexts/places/geometry.ts"), "utf8");
  const contracts = readFileSync(join(ROOT, "packages/contracts/src/places.ts"), "utf8");
  const fromDomain = [...domain.match(/PLACED_BY\s*=\s*\[([\s\S]*?)\]\s*as const/)[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
  const fromContracts = [...contracts.match(/PLACED_BY_VALUES\s*=\s*\[([\s\S]*?)\]\s*as const/)[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
  assert.ok(fromDomain.length >= 6);
  assert.deepEqual(fromContracts, fromDomain);
});

test("domain files the browser imports by subpath use nothing that exists only in Node (Buffer, process, node: modules)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "packages/domain/package.json"), "utf8"));
  const found = [];
  for (const key of Object.keys(pkg.exports)) {
    if (!key.startsWith("./contexts/")) continue;
    const source = join(ROOT, "packages/domain/src", key.replace(/^\.\//, "").replace(/\.js$/, ".ts"));
    const text = readFileSync(source, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    if (/\bBuffer\b|\bprocess\.|from\s+["']node:/.test(text)) found.push(`${relative(ROOT, source)} uses a Node-only feature`);
  }
  assert.deepEqual(found, []);
});
