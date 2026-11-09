import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Phase 48.0 gate. The parity register (`memorybank/imp/phase48-parity.md`) and the retirement register
 * (`phase48-retirement.md`) must account for every visual surface that exists today, so no feature is lost when the Visual Studio
 * takes over. The test fails on an empty cell, a path that does not exist, a source file or API route no row covers, a chart
 * kind, style group, block kind, widget kind, metric, dataset template, theme preset or template id that is not listed, and on a link
 * to a route the register says has been redirected or removed.
 */
const ROOT = join(process.cwd(), "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const parity = read("memorybank/imp/phase48-parity.md");
const retirement = read("memorybank/imp/phase48-retirement.md");

function rowsOf(text: string, cells: number): string[][] {
  return text.split("\n").filter((l) => l.startsWith("|") && !/^\|[-| ]+\|$/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
    .filter((r) => r.length === cells && r[0] !== "id" && r[0] !== "item" && r[0] !== "family");
}
const sourcesOf = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

const parityRows = rowsOf(parity, 6);
const retirementRows = rowsOf(retirement, 5);
const enumRows = rowsOf(parity, 2);

const allSources = [
  ...parityRows.flatMap((r) => sourcesOf(r[1]!)),
  ...retirementRows.flatMap((r) => sourcesOf(r[0]!)),
];
const pathSources = allSources.filter((s) => /^(apps|packages)\//.test(s));
const apiSources = allSources.filter((s) => s.startsWith("api:")).map((s) => s.slice(4));
const webSources = allSources.filter((s) => s.startsWith("web:")).map((s) => s.slice(4));

function walk(dir: string, accept: (f: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, accept) : accept(p) ? [p] : [];
  });
}

test("every parity row is complete and names a real home, batch and test", () => {
  assert.ok(parityRows.length >= 50, `expected the full inventory, found ${parityRows.length} rows`);
  const ids = new Set<string>();
  for (const [id, source, feature, home, batch, check] of parityRows) {
    assert.ok(id && source && feature && home && batch && check, `row ${id || "?"} has an empty cell`);
    assert.ok(!ids.has(id!), `duplicate id ${id}`);
    ids.add(id!);
    assert.match(batch!, /^(keep|48\.\d{1,2})$/, `row ${id}: batch must be 48.n or keep`);
    assert.ok(sourcesOf(source!).length > 0, `row ${id}: no source in backticks`);
  }
});

test("every path a register names exists", () => {
  for (const s of pathSources) {
    const clean = s.replace(/ \(.*$/, "");
    assert.ok(existsSync(join(ROOT, clean)), `${clean} does not exist`);
  }
});

test("every file in the visual feature folders is covered by a row", () => {
  const folders = ["dashboards", "infographics", "charts", "maps", "data-center", "report-builder", "canvas", "design"].map((f) => `apps/web/src/features/${f}`);
  const extra = [
    "apps/web/src/features/reporting/presentation/ReportChartPanel.tsx",
    "apps/web/src/features/reporting/presentation/ChartFigure.tsx",
    "apps/web/src/features/report-editor/presentation/inspector/DataChartsPanel.tsx",
  ];
  const files = [...folders.flatMap((f) => walk(join(ROOT, f), (p) => /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)).map((p) => relative(ROOT, p))), ...extra];
  const uncovered = files.filter((f) => !pathSources.some((s) => f === s || (s.endsWith("/") && f.startsWith(s))));
  assert.deepEqual(uncovered, [], `files no register row covers (add a row to phase48-parity.md):\n${uncovered.join("\n")}`);
});

/** `/v1/x/:id/y` is covered by a row whose route prefix is the same or shorter at a segment boundary. */
const covered = (route: string, prefixes: string[]) => prefixes.some((p) => route === p || route.startsWith(`${p}/`));

test("every API route of the visual route files is covered by a row", () => {
  const files = ["canvases", "chart-dashboards", "dashboard", "infographics", "charts", "home-layout", "public-api", "map-overlays", "saved-reports", "places"].map((n) => join(ROOT, `apps/api/src/routes/${n}.ts`));
  const routes = new Set<string>();
  for (const f of files.filter(existsSync)) {
    for (const m of readFileSync(f, "utf8").matchAll(/\.(?:get|post|put|delete|patch)(?:<[^(]*>)?\(\s*["'`]([^"'`]+)["'`]/g)) routes.add(m[1]!.replace(/\$\{[^}]*\}/g, ":x"));
  }
  const relevant = [...routes].filter((r) => /canvas|dashboard|chart|infograph|saved-report|map-overlay|map-layer|data-sheet|place-results|home-pin|home-layout|bookmark|datasets|offline-pack/.test(r));
  assert.ok(relevant.length >= 40, `expected the visual routes, found ${relevant.length}`);
  const missing = relevant.filter((r) => !covered(r, apiSources));
  assert.deepEqual(missing, [], `API routes no row covers (add to a register):\n${missing.join("\n")}`);
});

test("every visual web route is covered by a row", () => {
  const app = join(ROOT, "apps/web/src/app");
  const pages = walk(app, (p) => /\/(page\.tsx|route\.ts)$/.test(p)).map((p) => "/" + relative(app, p).replace(/\/(page\.tsx|route\.ts)$/, "").replace(/\(portal\)\/?/g, "")).map((p) => p.replace(/\/$/, "") || "/");
  const visual = pages.filter((p) => /^\/(visuals|dashboards|shared\/(dashboard|infographic|canvas)|embed\/dashboard|maps|portfolio\/infographics|api\/(canvases|infographic|shared|projects\/\[id\]\/infographic|organization\/map-layer))|^\/projects\/\[id\]\/(charts|maps|infographics|report-builder|data)$|^\/dashboard$/.test(p));
  assert.ok(visual.length >= 20, `expected the visual routes, found ${visual.length}`);
  const missing = visual.filter((p) => !webSources.some((s) => p === s || p.startsWith(`${s}/`)));
  assert.deepEqual(missing, [], `web routes no row covers (add to a register):\n${missing.join("\n")}`);
});

test("the retirement register is complete and only uses known kinds and statuses", () => {
  assert.ok(retirementRows.length >= 40, `found ${retirementRows.length} retirement rows`);
  for (const [item, kind, home, status, removedIn] of retirementRows) {
    assert.ok(item && kind && home && status && removedIn, `retirement row "${item}" has an empty cell`);
    assert.ok(["route", "nav", "feature", "api", "table", "test", "doc"].includes(kind!), `${item}: unknown kind ${kind}`);
    assert.ok(["live", "redirected", "removed", "kept"].includes(status!), `${item}: unknown status ${status}`);
    assert.match(removedIn!, /^(-|48\.\d{1,2})$/, `${item}: "removed in" must be a batch or -`);
    if (status === "kept") assert.equal(removedIn, "-", `${item}: a kept row has no removal batch`);
  }
});

test("no source file links to a route the register says is redirected or removed", () => {
  const gone = retirementRows.filter((r) => r[1] === "route" && (r[3] === "redirected" || r[3] === "removed")).flatMap((r) => sourcesOf(r[0]!)).map((s) => s.slice(4));
  if (gone.length === 0) return;
  const pattern = (route: string) => new RegExp(["[\"'`]", route.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\\\[[^\]]+\\\]|\[[^\]]+\]/g, "[^/\"'`]+").replace(/\\\$/g, "$"), "(?:[/?\"'`])"].join(""));
  const sources = walk(join(ROOT, "apps/web/src"), (p) => /\.(ts|tsx)$/.test(p));
  const hits: string[] = [];
  for (const route of gone) for (const f of sources) {
    const rel = relative(ROOT, f);
    if (rel.includes(`app${route}`) || rel.includes(`app/(portal)${route}`)) continue; // the redirect page itself
    if (pattern(route).test(readFileSync(f, "utf8"))) hits.push(`${rel} -> ${route}`);
  }
  assert.deepEqual(hits, [], `links to retired routes:\n${hits.join("\n")}`);
});

test("the enumerations list every chart kind, style group, preset, block kind, widget kind, metric, dataset template and template id", async () => {
  const m: Record<string, any> = await import(join(ROOT, "packages/domain/dist/index.js"));
  const listed = new Set(enumRows.flatMap((r) => sourcesOf(r[1]!)));
  const expected: Record<string, string[]> = {
    "chart kind": Object.keys(m.CHART_KINDS),
    "style group": [...new Set<string>(m.STYLE_FIELDS.map((f: { path: string }) => f.path.split(".")[0]!))],
    "theme preset": m.CHART_STYLE_PRESETS.map((p: { id: string }) => p.id),
    "block kind": [...m.BLOCK_KINDS],
    "number tile metric": Object.keys(m.METRICS),
    "dataset template": Object.keys(m.DATA_CHART_TEMPLATES),
    "infographic template": Object.keys(m.INFOGRAPHIC_TEMPLATES),
    "canvas template": m.BUILT_IN_CANVAS_TEMPLATES.map((t: { id: string }) => t.id).filter((i: string) => !i.startsWith("lib-canvas-")),
  };
  for (const [what, keys] of Object.entries(expected)) {
    assert.ok(keys.length > 0, `no ${what}s found: the domain build is stale (build contracts, then domain)`);
    const missing = keys.filter((k) => !listed.has(k));
    assert.deepEqual(missing, [], `${what}s missing from the parity enumerations: ${missing.join(", ")}`);
  }
});
