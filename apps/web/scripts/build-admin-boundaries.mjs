#!/usr/bin/env node
// Builds the per-country boundary files below admin 1 from geoBoundaries (William & Mary geoLab, gbOpen).
// Run with: node --experimental-strip-types apps/web/scripts/build-admin-boundaries.mjs [--levels 2,3] [--countries SDN,UGA | --set humanitarian] [--out apps/web/public/geo]
//
// One file per country and level (`<ISO>/ADM2.json`, simplified, coordinates rounded to ~100 m) and one `manifest.json` that records the
// source, licence and year of each, plus the files held back for their licence (share-alike / other: see boundary-sources.ts). A partial
// run merges into the existing manifest, so countries can be added one at a time. Nothing is read at run time from geoBoundaries.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { licenceVerdict, roundGeometry } from "../src/features/maps/domain/boundary-sources.ts";
import { HUMANITARIAN_COUNTRIES } from "../src/features/maps/domain/humanitarian-countries.ts";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const levels = (args.get("levels") ?? "2,3").split(",").map((n) => Number(n)).filter((n) => [1, 2, 3].includes(n));
// --countries SDN,UGA names countries; --set humanitarian (the default is every country geoBoundaries has) takes the editable list.
const only = args.get("countries") ? new Set(args.get("countries").split(",").map((s) => s.trim().toUpperCase())) : args.get("set") === "humanitarian" ? new Set(HUMANITARIAN_COUNTRIES) : null;
const OUT = args.get("out") ?? join(dirname(fileURLToPath(import.meta.url)), "../public/geo");
const API = "https://www.geoboundaries.org/api/current/gbOpen";

async function getJson(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (attempt >= tries) throw e;
      await new Promise((res) => setTimeout(res, 800 * attempt));
    }
  }
}

mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { generatedAt: "", dataset: "geoBoundaries gbOpen", attribution: "Boundaries: geoBoundaries (William & Mary geoLab), gbOpen release; each country's source and licence is listed in its map footer.", countries: [], held: [] };

const countries = new Map(manifest.countries.map((c) => [c.iso, c]));
const held = manifest.held.filter((h) => !(only ? only.has(h.iso) && levels.includes(h.level) : levels.includes(h.level)));

let written = 0, bytes = 0;
for (const level of levels) {
  const index = await getJson(`${API}/ALL/ADM${level}/`);
  const wanted = index.filter((m) => !only || only.has(m.boundaryISO));
  const queue = [...wanted];
  async function worker() {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const iso = m.boundaryISO;
      if (licenceVerdict(m.boundaryLicense) === "HOLD") { held.push({ iso, name: m.boundaryName, level, licence: m.boundaryLicense ?? "" }); continue; }
      try {
        const geo = await getJson(m.simplifiedGeometryGeoJSON);
        const features = geo.features.map((f) => ({ type: "Feature", properties: { name: f.properties.shapeName, id: f.properties.shapeID }, geometry: roundGeometry(f.geometry) }));
        const text = JSON.stringify({ type: "FeatureCollection", features });
        mkdirSync(join(OUT, iso), { recursive: true });
        writeFileSync(join(OUT, iso, `ADM${level}.json`), text);
        const country = countries.get(iso) ?? { iso, name: m.boundaryName, source: "", licence: "", yearRepresented: "", files: [] };
        // The attribution shown is that of the finest file shipped for the country.
        Object.assign(country, { source: m.boundarySource, licence: m.boundaryLicense, yearRepresented: m.boundaryYearRepresented });
        country.files = country.files.filter((f) => f.level !== level).concat({ level, file: `${iso}/ADM${level}.json`, units: features.length, bytes: Buffer.byteLength(text) }).sort((a, b) => a.level - b.level);
        countries.set(iso, country);
        written++; bytes += Buffer.byteLength(text);
      } catch (e) {
        console.error(`skip ${iso} ADM${level}: ${e.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`ADM${level}: ${wanted.length} countries listed`);
}

manifest.generatedAt = new Date().toISOString();
manifest.countries = [...countries.values()].sort((a, b) => a.iso.localeCompare(b.iso));
manifest.held = held.sort((a, b) => a.iso.localeCompare(b.iso) || a.level - b.level);
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`wrote ${written} files, ${(bytes / 1e6).toFixed(1)} MB; ${manifest.countries.length} countries in the manifest; ${manifest.held.length} files held for their licence`);
