#!/usr/bin/env node
// Writes each country's provinces (Natural Earth 10m admin-1, public domain) as its own small file: apps/web/public/geo/ADM1/<key>.json.
// Run with: node --experimental-strip-types apps/web/scripts/build-admin1-files.mjs [--out apps/web/public/geo]
//
// Before, every country's provinces travelled together as one JavaScript module (about 570 KB gzipped) that every map downloaded before it could
// draw. A country's own file is a few tens of KB. The bundled module is still there as the fallback when a file has not been synced (and for the
// older ECharts maps), so a missing file is slower, never broken. Ship with scripts/sync-geo.sh, before the code that reads them.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { admin1FileKey } from "../src/features/maps/domain/boundaries/join.ts";
import { ADMIN1_GEO } from "../src/features/workplan/domain/geo/admin1-geo.ts";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const OUT = join(args.get("out") ?? join(dirname(fileURLToPath(import.meta.url)), "../public/geo"), "ADM1");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const byCountry = new Map();
for (const f of ADMIN1_GEO.features) {
  const name = f.properties.country;
  if (!name) continue;
  const key = admin1FileKey(name);
  if (!key) continue;
  const entry = byCountry.get(key) ?? { name, features: [] };
  entry.features.push({ type: "Feature", properties: { name: f.properties.name, country: name }, geometry: f.geometry });
  byCountry.set(key, entry);
}
let bytes = 0;
for (const [key, entry] of byCountry) {
  const text = JSON.stringify({ type: "FeatureCollection", features: entry.features });
  writeFileSync(join(OUT, `${key}.json`), text);
  bytes += Buffer.byteLength(text);
}
console.log(`${byCountry.size} countries, ${(bytes / 1e6).toFixed(1)} MB in ${OUT}`);
