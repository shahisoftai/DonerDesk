// Replaces one country's OCHA boundaries with the latest release, after a person has looked at the check (Phase 49.3).
//   node --experimental-strip-types scripts/maps/update-cod.mjs SDN 2[,3,4]
// 1. keeps the current files in apps/web/public/geo/.previous/<ISO>-<date>/ (removed by hand after 90 days; sync-geo.sh never ships them);
// 2. runs build-ocha-boundaries.mjs for that country and those levels;
// 3. compares old and new units by P-code (diffBoundaryVersions) and writes <ISO>/ADM<n>.changes.json, named in the manifest entry
//    (`changes`), so the Places screen can list places whose code was retired or moved. Places are never rewritten;
// 4. rebuilds the level's tiles when it had them (build-boundary-tiles.mjs), and records the release as seen (check-cod-updates.mjs --record).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const geo = join(root, "apps/web/public/geo");
const [iso, levelArg] = process.argv.slice(2);
if (!/^[A-Z]{3}$/.test(iso ?? "") || !levelArg) { console.error("usage: update-cod.mjs <ISO3> <level[,level]>"); process.exit(1); }
const levels = levelArg.split(",").map(Number);
const { diffBoundaryVersions } = await import(join(root, "packages/domain/dist/index.js"));
const { unitFromFeature } = await import(join(root, "apps/web/src/features/maps/domain/boundaries/join.ts"));

const rowsOf = (file) => existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).features.map(unitFromFeature).filter(Boolean).map((u) => ({ pcode: u.pcode, name: u.name, parentPcode: u.parentPcode })) : [];
const keep = join(geo, ".previous", `${iso}-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(keep, { recursive: true });
const before = {};
for (const level of levels) {
  const file = join(geo, iso, `ADM${level}.json`);
  before[level] = rowsOf(file);
  if (existsSync(file)) cpSync(file, join(keep, `ADM${level}.json`));
}
console.log(`kept the current files in ${keep}`);
execFileSync("node", ["--experimental-strip-types", join(root, "apps/web/scripts/build-ocha-boundaries.mjs"), "--countries", iso, "--levels", levels.join(",")], { stdio: "inherit" });

const manifestPath = join(geo, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const country = manifest.countries.find((c) => c.iso === iso);
let tiled = false;
for (const level of levels) {
  const diff = diffBoundaryVersions(before[level], rowsOf(join(geo, iso, `ADM${level}.json`)));
  const name = `${iso}/ADM${level}.changes.json`;
  writeFileSync(join(geo, name), JSON.stringify({ changedAt: new Date().toISOString(), ...diff }, null, 2));
  const entry = country?.files.find((f) => f.level === level);
  if (entry) { entry.changes = name; tiled ||= !!entry.tiles; }
  console.log(`ADM${level}: ${diff.appeared.length} new, ${diff.disappeared.length} retired, ${diff.reparented.length} moved, ${diff.renamed.length} renamed -> ${name}`);
}
manifest.generatedAt = new Date().toISOString();
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
if (tiled) execFileSync("node", ["--experimental-strip-types", join(here, "build-boundary-tiles.mjs"), "--countries", iso, "--levels", levels.join(",")], { stdio: "inherit" });
execFileSync("node", [join(here, "check-cod-updates.mjs"), "--record"], { stdio: "inherit" });
console.log("Review the changes files, then scripts/sync-geo.sh.");
