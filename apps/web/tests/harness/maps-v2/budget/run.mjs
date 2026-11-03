// The performance budgets for the maps (Phase 41.10), measured, not assumed:
//   1. the map code a screen downloads, gzipped (a production-style build: minified and split, as the app ships it);
//   2. how long the first map takes on a slow connection ("Fast 3G": 1.6 Mbps down, 750 Kbps up, 562.5 ms round trip), cold cache;
//   3. the memory of the largest view the product could be asked for (Bangladesh at admin 4).
//   pnpm --filter @donordesk/web test:maps-budget
// It prints every number and exits 1 when one is over its budget. The numbers are for the map code and its data; the rest of the app is not in them.
import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, createGzip } from "node:zlib";
import { chromium } from "@playwright/test";
import { loadEsbuild } from "../../esbuild-loader.mjs";
import { harnessAlias } from "../build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../../..");
// `targets` are what the plan hoped for; a miss is reported, never hidden. `ceilings` are what fails the run: where it stands today, with room, so it cannot quietly get worse.
const BUDGET = { mapCodeGzipKB: 350, bangladeshHeapMB: 150 };
const TARGET = { firstMapSeconds: 2.5 };
// Measured on a development machine with software graphics, often with other jobs running: the same profile varied by about 50% between runs (Slow 4G: 8.0, 10.7 and 12.2 s).
// So these are regression ceilings with room, not claims about a phone. What they catch is a change that makes the first map much slower (more bytes before the map exists, or one more
// step in the chain: script, map library, tile header, directory, tiles, fonts).
const CEILING = { fast3gSeconds: 25, slow4gSeconds: 16 };
const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
// What Lighthouse calls "Slow 4G": the same speed with a 150 ms round trip.
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

const out = mkdtempSync(join(tmpdir(), "maps-budget-"));
const esbuild = await loadEsbuild();
const result = await esbuild.build({
  entryPoints: { entry: join(here, "entry.ts"), main: join(here, "main.tsx") },
  bundle: true, splitting: true, format: "esm", outdir: out, minify: true, metafile: true, jsx: "automatic", platform: "browser", absWorkingDir: web,
  nodePaths: [join(web, "node_modules")], loader: { ".css": "css", ".pbf": "empty" }, alias: harnessAlias(),
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_MAP_ENGINE": '"maplibre"' }, logLevel: "error",
});
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><style>.w-full{width:100%}.h-56{height:14rem}.h-\\[600px\\]{height:600px}.h-\\[26rem\\]{height:26rem}.h-\\[28rem\\]{height:28rem}.overflow-hidden{overflow:hidden}</style><link rel="stylesheet" href="main.css"></head><body><div id="root"></div><script type="module" src="main.js"></script></body></html>');
if (!existsSync(join(out, "main.css"))) writeFileSync(join(out, "main.css"), "");

// ---- 1. size ---------------------------------------------------------------------------------------------------------------------------------
const outputs = Object.entries(result.metafile.outputs).filter(([name]) => name.endsWith(".js"));
const gz = (name) => gzipSync(readFileSync(resolve(web, name))).length;
const packagesOf = (meta) => new Set(Object.keys(meta.inputs).map((p) => /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(p)?.[1]).filter(Boolean));
const info = new Map(outputs.map(([name, meta]) => [name, { gz: gz(name), kb: Math.round(gz(name) / 102.4) / 10, packages: packagesOf(meta), imports: meta.imports }]));
const entryName = outputs.find(([, m]) => m.entryPoint?.endsWith("entry.ts"))?.[0];
const reach = (start, kinds) => {
  const seen = new Set([start]);
  const walk = (n) => { for (const i of info.get(n)?.imports ?? []) if (info.has(i.path) && kinds.includes(i.kind) && !seen.has(i.path)) { seen.add(i.path); walk(i.path); } };
  walk(start);
  return [...seen];
};
const staticSet = reach(entryName, ["import-statement"]);
const everySet = reach(entryName, ["import-statement", "dynamic-import"]);
const drawing = everySet.filter((n) => info.get(n).packages.has("terra-draw"));
// The world and province outlines and the place gazetteer are bundled as modules: data that travels as JavaScript. They are not map code.
const dataChunks = everySet.filter((n) => Object.keys(outputs.find(([name]) => name === n)[1].inputs).some((p) => /workplan\/domain\/geo\//.test(p)));
const code = everySet.filter((n) => !drawing.includes(n) && !dataChunks.includes(n));
const sum = (names) => names.reduce((t, n) => t + info.get(n).gz, 0);
const kb = (bytes) => Math.round(bytes / 102.4) / 10;
console.log("size (gzipped, as the app ships it):");
for (const n of everySet) console.log(`  ${staticSet.includes(n) ? "static   " : "on demand"} ${String(kb(info.get(n).gz)).padStart(7)} KB  ${drawing.includes(n) ? "drawing" : dataChunks.includes(n) ? "bundled geography (data; the provinces module is only a fallback)" : [...info.get(n).packages].filter((p) => /maplibre|pmtiles|protomaps/.test(p)).join(", ") || "our code"}`);
console.log(`  map code (what a read-only map needs): ${kb(sum(code))} KB · bundled geography data: ${kb(sum(dataChunks))} KB · drawing, only when someone draws: ${kb(sum(drawing))} KB`);
const results = [];
const check = (name, ok, detail) => { results.push(`${ok ? "ok  " : "OVER"} ${name}: ${detail}`); console.log(results.at(-1)); };
const note = (name, detail) => { results.push(`note ${name}: ${detail}`); console.log(results.at(-1)); };
check("the map code, gzipped", kb(sum(code)) <= BUDGET.mapCodeGzipKB, `${kb(sum(code))} KB of ${BUDGET.mapCodeGzipKB} KB`);
check("the drawing library is not in what a read-only map downloads", drawing.length > 0 && drawing.every((n) => !staticSet.includes(n)), drawing.length === 0 ? "no drawing chunk found (the check cannot run)" : `${drawing.length} chunk(s), on demand only`);

// ---- a server like production: text is gzipped, tiles are read by byte range -------------------------------------------------------------------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".pbf": "application/x-protobuf" };
const log = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const rel = decodeURIComponent(url.pathname);
  const path = rel === "/" ? join(out, "index.html") : /^\/(geo|tiles|vendor)\//.test(rel) ? join(web, "public", rel) : join(out, rel);
  const entry = { path: rel, at: Date.now(), done: 0 };
  log.push(entry);
  res.on("close", () => { entry.done = Date.now(); });
  if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404).end(); return; }
  const size = statSync(path).size, type = TYPES[extname(path)] ?? "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = Number(m[1] || 0), end = Math.min(size - 1, m[2] ? Number(m[2]) : size - 1);
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(path, { start, end }).pipe(res);
  } else if (TYPES[extname(path)] && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    res.writeHead(200, { "content-type": type, "content-encoding": "gzip" });
    createReadStream(path).pipe(createGzip({ level: 6 })).pipe(res);
  } else { res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" }); createReadStream(path).pipe(res); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

// ---- 2. the first map on a slow connection -----------------------------------------------------------------------------------------------------
for (const [label, profile, ceiling] of [["Fast 3G (562.5 ms round trip)", FAST_3G, CEILING.fast3gSeconds], ["Slow 4G (150 ms round trip)", SLOW_4G, CEILING.slow4gSeconds]]) {
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  let transferred = 0;
  cdp.on("Network.loadingFinished", (e) => { transferred += e.encodedDataLength ?? 0; });
  if (!process.env.NO_THROTTLE) await cdp.send("Network.emulateNetworkConditions", profile);
  const from = log.length, t0 = Date.now();
  await page.goto(base, { waitUntil: "commit" });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 180000 });
  const tCanvas = (Date.now() - t0) / 1000;
  await page.waitForSelector('[data-map-ready="true"]', { state: "attached", timeout: 180000 });
  const tReady = (Date.now() - t0) / 1000;
  console.log(`first map on ${label}, cold cache: the map exists at ${tCanvas.toFixed(1)} s, finished drawing at ${tReady.toFixed(1)} s, ${log.slice(from).length} requests, ${Math.round(transferred / 1024)} KB downloaded`);
  if (process.env.WATERFALL || label.startsWith("Fast")) for (const e of log.slice(from).filter((x) => x.done).slice(0, 40)) console.log(`    ${((e.at - t0) / 1000).toFixed(1).padStart(5)} s  ${e.path}`);
  check(`the first map on ${label.split(" (")[0]}`, tReady <= ceiling, `${tReady.toFixed(1)} s (ceiling ${ceiling} s)`);
  if (tReady > TARGET.firstMapSeconds) note(`the plan's target for the first map (${TARGET.firstMapSeconds} s) on ${label.split(" (")[0]}`, `MISSED at ${tReady.toFixed(1)} s`);
  await context.close();
}

// ---- 3. the largest view ---------------------------------------------------------------------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto(`${base}?page=heavy`);
  await page.waitForSelector(".maplibregl-canvas", { timeout: 120000 });
  await page.waitForTimeout(8000);
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const heapMB = metrics.JSHeapUsedSize / (1024 * 1024);
  console.log(`Bangladesh at admin 4 (5,160 units, ~259,000 vertices): JS heap ${heapMB.toFixed(0)} MB (total ${(metrics.JSHeapTotalSize / 1048576).toFixed(0)} MB); the graphics memory is not measurable here`);
  check("the memory of Bangladesh at admin 4 (JS heap)", heapMB <= BUDGET.bangladeshHeapMB, `${heapMB.toFixed(0)} MB of ${BUDGET.bangladeshHeapMB} MB`);
  await context.close();
}

await browser.close();
server.close();
console.log("\n" + results.join("\n"));
if (results.some((r) => r.startsWith("OVER"))) process.exit(1);
