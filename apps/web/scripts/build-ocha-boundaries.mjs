#!/usr/bin/env node
// Downloads OCHA COD-AB boundaries (Humanitarian Data Exchange, datasets "cod-ab-<iso3>") and writes them next to the geoBoundaries ones.
// Run with: node --experimental-strip-types apps/web/scripts/build-ocha-boundaries.mjs [--countries SDN,ETH] [--levels 2,3] [--epsilon 0.01] [--out apps/web/public/geo]
//
// For every country OCHA publishes, the latest COD-AB dataset is read; a unit whose `valid_to` is in the past is left out (the newer one
// stands). A level present in OCHA's file REPLACES the geoBoundaries file for that country and level; the manifest records the origin, source,
// licence and year per file. Only CC BY / CC BY-IGO style licences ship (see boundary-sources.ts); anything else is listed under `held`.
// Needs the `unzip` command. Nothing is read from HDX at run time.
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { licenceVerdict, requiresShareAlike, roundGeometry, ROUND_DIGITS, SIMPLIFY_EPSILON } from "../src/features/maps/domain/boundary-sources.ts";
import { codFileName, geojsonZipUrl, readLevel } from "../src/features/maps/domain/ocha-cod.ts";
import { simplifyGeometry } from "../src/features/maps/domain/simplify-geometry.ts";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const levels = (args.get("levels") ?? "2,3").split(",").map(Number).filter((n) => [2, 3, 4].includes(n));
const only = args.get("countries") ? new Set(args.get("countries").split(",").map((s) => s.trim().toUpperCase())) : null;
const epsilonArg = args.get("epsilon") ? Number(args.get("epsilon")) : null; // overrides the per-level tolerance
const OUT = args.get("out") ?? join(dirname(fileURLToPath(import.meta.url)), "../public/geo");
const HDX = "https://data.humdata.org/api/3/action";
const today = new Date().toISOString().slice(0, 10);

async function getJson(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30_000) }); if (!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); }
    catch (e) { if (attempt >= tries) throw e; await new Promise((res) => setTimeout(res, 1000 * attempt)); }
  }
}
// HDX answers 202 with an empty body to some clients (Node's fetch among them) and serves `curl`, so the zips are downloaded with curl itself.
// An empty body is "not ready", never a result.
const execFileAsync = promisify(execFile);
async function getBuffer(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { stdout } = await execFileAsync("curl", ["-sSL", "--fail", "--retry", "3", "--max-time", "900", url], { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 });
      if (stdout.length === 0) throw new Error(`empty body ${url}`);
      return stdout;
    } catch (e) { if (attempt >= tries) throw e; await new Promise((res) => setTimeout(res, 3000 * attempt)); }
  }
}
const unzipOne = (zip, name) => { try { return execFileSync("unzip", ["-p", zip, name], { maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8"); } catch { return null; } };

mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { generatedAt: "", dataset: "geoBoundaries gbOpen", attribution: "", countries: [], held: [] };
manifest.attribution = "Boundaries: OCHA COD-AB (Humanitarian Data Exchange) where available, otherwise geoBoundaries (William & Mary geoLab); each file's source and licence is shown in the map footer.";
const countries = new Map(manifest.countries.map((c) => [c.iso, c]));
let held = manifest.held;

// Every COD-AB dataset OCHA lists (names look like cod-ab-sdn).
const search = await getJson(`${HDX}/package_search?q=name:cod-ab-*&fl=name&rows=500`);
const names = (search.result.results ?? []).map((r) => r.name).filter((n) => /^cod-ab-[a-z]{3}$/.test(n));
const isos = names.map((n) => n.slice(7).toUpperCase()).filter((iso) => !only || only.has(iso));
console.log(`${isos.length} COD-AB datasets to read`);

function save() {
  manifest.generatedAt = new Date().toISOString();
  manifest.countries = [...countries.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  manifest.held = held.sort((a, b) => a.iso.localeCompare(b.iso) || a.level - b.level);
  writeFileSync(manifestPath, JSON.stringify(manifest));
}
// Resumable: a country whose every wanted level already comes from OCHA is skipped unless --refresh is given.
const doneAlready = (iso) => { const c = countries.get(iso); return !!c && levels.every((l) => { const f = c.files.find((x) => x.level === l); return !f || f.origin === "OCHA COD-AB"; }) && c.files.some((f) => f.origin === "OCHA COD-AB"); };

const report = { replaced: 0, written: 0, noFile: [], noLicence: [], failed: [] };
const tmp = join(OUT, ".ocha-tmp");
mkdirSync(tmp, { recursive: true });
const queue = args.get("refresh") ? [...isos] : isos.filter((iso) => !doneAlready(iso));
console.log(`${isos.length - queue.length} already done, ${queue.length} to go`);
async function worker() {
  for (let iso = queue.shift(); iso; iso = queue.shift()) {
    try {
      console.log(`reading ${iso}`);
      const pkg = (await getJson(`${HDX}/package_show?id=cod-ab-${iso.toLowerCase()}`)).result;
      const licence = pkg.license_title ?? "";
      if (licenceVerdict(licence) === "HOLD") { report.noLicence.push(`${iso} (${licence || "no licence stated"})`); held = held.filter((h) => !(h.iso === iso && h.origin === "OCHA")).concat(levels.map((level) => ({ iso, name: pkg.title ?? iso, level, licence, origin: "OCHA" }))); continue; }
      const url = geojsonZipUrl(pkg);
      if (!url) { report.noFile.push(iso); continue; }
      const zip = join(tmp, `${iso}.zip`);
      writeFileSync(zip, await getBuffer(url));
      for (const level of levels) {
        const text = unzipOne(zip, codFileName(iso, level));
        if (!text) continue; // this country has no such level (the zip itself was checked non-empty above)
        const read = readLevel(JSON.parse(text).features ?? [], level, today);
        if (read.features.length === 0) continue;
        const features = read.features.map((f) => ({ ...f, geometry: roundGeometry(simplifyGeometry(f.geometry, epsilonArg ?? SIMPLIFY_EPSILON[level]), ROUND_DIGITS[level]) })).filter((f) => f.geometry);
        const body = JSON.stringify({ type: "FeatureCollection", features });
        mkdirSync(join(OUT, iso), { recursive: true });
        writeFileSync(join(OUT, iso, `ADM${level}.json`), body);
        const country = countries.get(iso) ?? { iso, name: (pkg.title ?? iso).replace(/ - Subnational Administrative Boundaries$/i, ""), source: "OCHA COD-AB", licence, yearRepresented: read.version.slice(0, 4), files: [] };
        if (country.files.some((f) => f.level === level && f.origin !== "OCHA COD-AB")) report.replaced++;
        country.files = country.files.filter((f) => f.level !== level).concat({ level, file: `${iso}/ADM${level}.json`, units: features.length, bytes: Buffer.byteLength(body), origin: "OCHA COD-AB", source: "OCHA COD-AB", licence, yearRepresented: read.version.slice(0, 4) || "", ...(requiresShareAlike(licence) ? { shareAlike: true } : {}) }).sort((a, b) => a.level - b.level);
        countries.set(iso, country);
        held = held.filter((h) => !(h.iso === iso && h.level === level)); // OCHA fills a level geoBoundaries had to hold
        report.written++;
      }
      rmSync(zip, { force: true });
      save();
    } catch (e) { report.failed.push(`${iso}: ${e.message}`); console.error(`failed ${iso}: ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 3 }, () => worker()));

save();
rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ filesWritten: report.written, replacedGeoBoundaries: report.replaced, noGeoJsonResource: report.noFile, heldForLicence: report.noLicence, failed: report.failed }, null, 1));
