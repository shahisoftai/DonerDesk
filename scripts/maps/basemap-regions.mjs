// Which detailed basemap regions live projects need (Phase 49.2). Input: one country name per line (stdin), for example from the host:
//   ssh contabo "sudo -u postgres psql donordesk -Atc \"select distinct country from \\\"Project\\\" where status <> 'ARCHIVED'\"" \
//     | node --experimental-strip-types scripts/maps/basemap-regions.mjs
// Prints each country with the region that holds it (or "world only"), then the regions to keep. With --write it sets `keep` in
// basemap-regions.json (the world file is always kept). Country names only: no tenant, project or person leaves the host in this list.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const confPath = join(here, "basemap-regions.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));
const { WORLD_GEO } = await import(join(here, "../../apps/web/src/features/workplan/domain/geo/world-geo.ts"));

const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
function bbox(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => { if (typeof c[0] === "number") { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else c.forEach(walk); };
  walk(geometry.coordinates);
  return b;
}
const inside = (v, box) => v[0] >= box[0] && v[1] >= box[1] && v[2] <= box[2] && v[3] <= box[3];
const names = readFileSync(0, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
const keep = new Set();
for (const name of names) {
  const f = WORLD_GEO.features.find((x) => norm(x.properties.name) === norm(name) || norm(name).startsWith(norm(x.properties.name)));
  if (!f) { console.log(`${name}: not on the world map (check the spelling)`); continue; }
  const box = bbox(f.geometry);
  const region = conf.regions.filter((r) => inside(box, r.bbox)).sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0];
  console.log(`${name}: ${region ? region.id : "world only (no detailed region holds it: add one to regions.ts and basemap-regions.json)"}`);
  if (region) keep.add(region.id);
}
console.log(`keep: ${[...keep].join(", ") || "(none)"}`);
if (process.argv.includes("--write")) {
  for (const r of conf.regions) r.keep = keep.has(r.id);
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
  console.log(`written ${confPath}`);
}
