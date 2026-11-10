// Publishes the finer boundary levels (2 to 4) as vector tiles (Phase 49.3), one PMTiles file per country and level next to the GeoJSON:
//   apps/web/public/geo/<ISO>/ADM<n>.pmtiles        outlines and `ref` only (never a value), layer "adm<n>", simplified per zoom by tippecanoe
//   apps/web/public/geo/<ISO>/ADM<n>.index.json     every unit's ref, name, P-codes and box (what the browser joins on, without outlines)
// and records both in manifest.json (`index`, `tiles` on the file entry). The GeoJSON stays: pin placing and drawing test points against it.
//   node --experimental-strip-types scripts/maps/build-boundary-tiles.mjs [--countries BGD,NGA] [--levels 3,4] [--min-units 300]
// A level is tiled only when it has at least --min-units units (default 300): a small file is faster as one GeoJSON request.
// Needs `tippecanoe` (2.x, which writes .pmtiles directly) on PATH. Resumable: a level whose .pmtiles is newer than its .json is skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const geo = join(here, "../../apps/web/public/geo");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const onlyCountries = args.get("countries")?.split(",").map((s) => s.trim().toUpperCase());
const levels = (args.get("levels") ?? "2,3,4").split(",").map(Number);
const minUnits = Number(args.get("min-units") ?? 300);

try { execFileSync("tippecanoe", ["--version"], { stdio: "ignore" }); } catch { console.error("tippecanoe not found: install it first (https://github.com/felt/tippecanoe)."); process.exit(1); }
const { unitFromFeature } = await import(join(here, "../../apps/web/src/features/maps/domain/boundaries/join.ts"));
const { geometryBounds } = await import(join(here, "../../apps/web/src/features/maps/domain/model/bounds.ts"));

const manifestPath = join(geo, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const round = (n) => Math.round(n * 1e4) / 1e4;
let made = 0;
for (const country of manifest.countries) {
  if (onlyCountries && !onlyCountries.includes(country.iso)) continue;
  for (const entry of country.files) {
    if (!levels.includes(entry.level) || entry.units < minUnits) continue;
    const src = join(geo, entry.file);
    const base = entry.file.replace(/\.json$/, "");
    const tiles = `${base}.pmtiles`, index = `${base}.index.json`;
    if (existsSync(join(geo, tiles)) && statSync(join(geo, tiles)).mtimeMs > statSync(src).mtimeMs && entry.tiles) { console.log(`skip ${entry.file}: tiles are current`); continue; }
    const collection = JSON.parse(readFileSync(src, "utf8"));
    const rows = [], lines = [];
    for (const f of collection.features) {
      const u = unitFromFeature(f);
      if (!u) continue;
      const b = geometryBounds(u.geometry);
      if (!b) continue;
      rows.push({ ref: u.ref, name: u.name, ...(u.pcode ? { pcode: u.pcode } : {}), ...(u.parentPcode ? { parentPcode: u.parentPcode } : {}), bbox: b.map(round) });
      lines.push(JSON.stringify({ type: "Feature", properties: { ref: u.ref }, geometry: u.geometry }));
    }
    const sourceLayer = `adm${entry.level}`;
    const ndjson = join(geo, `${base}.tmp.ndjson`);
    writeFileSync(ndjson, lines.join("\n"));
    execFileSync("tippecanoe", ["-o", join(geo, `${tiles}.tmp`), "-l", sourceLayer, "-zg", "--maximum-zoom=12", "--minimum-zoom=3", "--detect-shared-borders", "--coalesce-densest-as-needed", "--extend-zooms-if-still-dropping", "--no-tile-size-limit", "-y", "ref", "--force", "-P", ndjson], { stdio: "inherit" });
    unlinkSync(ndjson);
    execFileSync("mv", [join(geo, `${tiles}.tmp`), join(geo, tiles)]);
    writeFileSync(join(geo, index), JSON.stringify({ sourceLayer, units: rows }));
    entry.index = index;
    entry.tiles = { file: tiles, sourceLayer };
    made++;
    manifest.generatedAt = new Date().toISOString(); // a new stamp: every versioned /geo address changes, so no browser keeps an old index
    console.log(`${entry.file}: ${rows.length} units -> ${tiles} (${Math.round(statSync(join(geo, tiles)).size / 1024)} KB), index ${Math.round(statSync(join(geo, index)).size / 1024)} KB`);
    // The catalogue is written after each file, so an interrupted run keeps what it finished.
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}
console.log(`${made} level(s) tiled.`);
