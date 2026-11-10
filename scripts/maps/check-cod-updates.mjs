// Is there a newer OCHA COD-AB release for any country we ship? (Phase 49.3) Reads HDX's catalogue only; downloads and replaces nothing.
//   node scripts/maps/check-cod-updates.mjs [--record]
// For each OCHA country in apps/web/public/geo/manifest.json it reads the dataset "cod-ab-<iso3>" and compares HDX's `metadata_modified`
// with the date recorded in apps/web/public/geo/cod-versions.json. It prints the countries with a newer release and exits 3 when there is
// any (so a timer can mail the report). --record stores today's dates as seen (run it after `update-cod.mjs` has replaced a country).
// The first run, with no cod-versions.json, records everything and reports nothing. HDX answers Node's fetch with an empty 202, so curl is used.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const geo = process.env.GEO_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/geo");
const manifest = JSON.parse(readFileSync(join(geo, "manifest.json"), "utf8"));
const statePath = join(geo, "cod-versions.json");
const first = !existsSync(statePath);
const state = first ? {} : JSON.parse(readFileSync(statePath, "utf8"));
const record = first || process.argv.includes("--record");

function dataset(iso) {
  try {
    const out = execFileSync("curl", ["-sSL", "--fail", "--retry", "3", "--max-time", "60", `https://data.humdata.org/api/3/action/package_show?id=cod-ab-${iso.toLowerCase()}`], { encoding: "utf8" });
    const body = JSON.parse(out);
    return body.success ? body.result : null;
  } catch { return null; }
}

const newer = [];
const ocha = manifest.countries.filter((c) => c.files.some((f) => f.origin === "OCHA COD-AB"));
for (const c of ocha) {
  const d = dataset(c.iso);
  if (!d) { console.log(`${c.iso}: could not read HDX (skipped)`); continue; }
  const seen = state[c.iso]?.modified;
  if (seen && d.metadata_modified > seen) newer.push({ iso: c.iso, name: c.name, seen, now: d.metadata_modified, date: d.dataset_date ?? "" });
  if (record || !seen) state[c.iso] = { modified: d.metadata_modified, checkedAt: new Date().toISOString() };
}
writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
if (first) { console.log(`First run: recorded ${Object.keys(state).length} countries; nothing to compare yet.`); process.exit(0); }
if (newer.length === 0) { console.log(`No newer OCHA boundary release for ${ocha.length} countries.`); process.exit(0); }
console.log(`Newer OCHA boundary releases (${newer.length}). Review, then: node --experimental-strip-types scripts/maps/update-cod.mjs <ISO> <level>`);
for (const n of newer) console.log(`  ${n.iso} ${n.name}: ours ${n.seen.slice(0, 10)}, HDX ${n.now.slice(0, 10)}${n.date ? ` (dataset date ${n.date})` : ""}`);
process.exit(3);
