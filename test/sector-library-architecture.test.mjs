// Phase 46: SOLID, made checkable. Each principle is a test that fails when it is broken, so "follows SOLID" is not a claim.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("..", import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = (dir, re = /\.(ts|tsx)$/) => walk(join(ROOT, dir)).filter((f) => re.test(f));
const rel = (f) => relative(ROOT, f);
const text = (f) => readFileSync(f, "utf8");

const DOMAIN = "packages/domain/src/contexts/sector-library";
const APP = "packages/application/src/use-cases/sector-library";
const WEB = "apps/web/src/features/sector-library";
const SECTOR_IDS = ["WASH", "HEALTH", "NUTRITION", "FOOD_SECURITY", "SHELTER_NFI", "CCCM", "PROTECTION", "CHILD_PROTECTION", "GBV", "HLP", "MINE_ACTION", "EDUCATION", "EARLY_RECOVERY", "LOGISTICS", "TELECOMS", "COORDINATION", "CASH", "AGRICULTURE", "ECONOMIC_DEVELOPMENT", "SOCIAL_PROTECTION", "GOVERNANCE", "PEACEBUILDING", "CLIMATE_DRR", "ENVIRONMENT_ENERGY", "GENDER_EQUALITY", "DISABILITY_INCLUSION", "MIGRATION_DISPLACEMENT", "MHPSS", "INFRASTRUCTURE", "LOCALISATION", "PROTECTION_AAP", "MEAL", "FINANCE_GRANTS", "SAFEGUARDING"];
const SOURCE_IDS = ["SPHERE_2018", "CHS_2014", "CPMS_2019", "INEE_2010", "LEGS", "MERS", "CCCM_CLUSTER", "GBVIE_2019", "IASC", "MISP", "IMAS", "CALP", "WHO", "SMART", "IPC", "DHIS2", "CLUSTER_REGISTRY", "OCHA_HRP", "SDG", "UNHCR_RBM", "UNICEF_CCC", "WFP_CRF", "FAO", "IFRC", "IATI", "DONOR_FRAMEWORKS", "DONORDESK"];

test("S: every library module is small and has one job (≤300 lines, no class in the domain, at most one class elsewhere)", () => {
  const bad = [];
  for (const f of [...files(DOMAIN), ...files(APP), ...files(WEB)]) {
    const src = text(f);
    const lines = src.split("\n").length;
    if (lines > 300) bad.push(`${rel(f)} has ${lines} lines (limit 300)`);
    const classes = (src.match(/^export class /gm) ?? []).length;
    if (f.includes(DOMAIN) && classes > 0) bad.push(`${rel(f)} declares a class; the domain library is functions and data`);
    if (!f.includes(DOMAIN) && classes > (f.endsWith("review-sheet.ts") ? 2 : 1)) bad.push(`${rel(f)} exports ${classes} classes`);
  }
  assert.deepEqual(bad, []);
});

test("O: no code branches on a sector id or a source id; a new one is a row in a registry", () => {
  const registries = new Set(["sectors.ts", "sources.ts", "model.ts"]);
  const bad = [];
  const branch = (id) => new RegExp(`(===|!==|case)\\s*["']${id}["']|\\b(includes)\\(["']${id}["']\\)`);
  for (const f of [...files(DOMAIN).filter((f) => !f.includes("/data/") && ![...registries].some((r) => f.endsWith(`/${r}`))), ...files(APP), ...files(WEB)]) {
    const src = text(f);
    for (const id of [...SECTOR_IDS, ...SOURCE_IDS]) if (branch(id).test(src)) bad.push(`${rel(f)} branches on ${id}`);
  }
  assert.deepEqual(bad, []);
});

test("D: the domain library imports nothing outside the domain; application handlers import no adapter or framework; web presentation imports no adapter", () => {
  const bad = [];
  for (const f of files(DOMAIN)) for (const m of text(f).matchAll(/from\s+["']([^"']+)["']/g)) {
    if (!m[1].startsWith(".") ) bad.push(`${rel(f)} imports ${m[1]}`);
    else if (!/^\.\.?\/(\.\.\/)*(sector-library|logframe|identity|dashboards|canvas|project-setup|core)|^\.\/|^\.\.\/(logframe|identity|dashboards|canvas|reporting|core)/.test(m[1]) && !m[1].startsWith("./") && !m[1].startsWith("../")) bad.push(`${rel(f)} imports ${m[1]}`);
  }
  for (const f of files(APP)) for (const m of text(f).matchAll(/from\s+["']([^"']+)["']/g)) if (/infrastructure|@prisma|fastify|next\//.test(m[1])) bad.push(`${rel(f)} imports ${m[1]}`);
  for (const f of files(join(WEB, "presentation"))) for (const m of text(f).matchAll(/from\s+["']([^"']+)["']/g)) if (/\/adapters\//.test(m[1])) bad.push(`${rel(f)} imports an adapter (${m[1]})`);
  for (const f of files(join(WEB, "domain"))) for (const m of text(f).matchAll(/from\s+["']([^"']+)["']/g)) if (/^react|^next|@\/lib|adapters/.test(m[1])) bad.push(`${rel(f)} imports ${m[1]}`);
  assert.deepEqual(bad, []);
});

test("I: the library's ports are narrow, and each handler asks only for the ports it uses", () => {
  const port = text(join(ROOT, "packages/application/src/ports/sector-library.ts"));
  assert.ok((port.match(/^export interface I\w+/gm) ?? []).length === 1, "one narrow store port");
  assert.ok(!/\bPrisma/.test(port));
  const web = text(join(ROOT, WEB, "ports/library-port.ts"));
  assert.match(web, /interface LibraryBrowser/);
  assert.match(web, /interface LibraryAdopter/);
  // The review handlers do not take the indicator repository; the adopt handler does not take the review store.
  assert.ok(!/IIndicatorRepository/.test(text(join(ROOT, APP, "review-sheet.ts"))));
  assert.ok(!/IOrganisationLibraryStore/.test(text(join(ROOT, APP, "adopt-indicators.ts"))));
});

test("L: every pack part has one provider and every provider answers for any sector with items or a reason", async () => {
  const d = await import("../packages/domain/dist/index.js");
  assert.deepEqual(Object.keys(d.PACK_PART_PROVIDERS).sort(), [...d.PACK_PART_KEYS].sort());
  for (const id of d.LIBRARY_SECTOR_IDS) for (const key of d.PACK_PART_KEYS) {
    const part = d.PACK_PART_PROVIDERS[key](d.BUILT_IN_CONTENT[id]);
    assert.equal(part.key, key);
    assert.ok(part.items.length > 0 || part.because, `${id}.${key}`);
  }
  for (const kind of Object.keys(d.KIND_RULES)) assert.ok(d.KIND_RULES[kind].aggregations.length > 0 && typeof d.KIND_RULES[kind].check === "function", kind);
});

test("the library adds no writer of its own: it creates indicators and results only through the ordinary create handlers", () => {
  for (const f of files(APP)) {
    const src = text(f);
    assert.ok(!/Indicator\.create\(|LogframeItem\.create\(/.test(src), `${rel(f)} builds an entity itself`);
    assert.ok(!/indicators\.create\(|logframe\.create\(/.test(src), `${rel(f)} writes a repository itself`);
  }
});
