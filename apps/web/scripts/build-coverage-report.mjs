#!/usr/bin/env node
// Writes the boundary coverage report from the catalogue the maps read: which countries have which levels, from whom, under what licence, what is
// held back and why. Re-run it whenever the boundaries are rebuilt.
//   node --experimental-strip-types apps/web/scripts/build-coverage-report.mjs [--manifest apps/web/public/geo/manifest.json] [--out memorybank/imp/phase41-coverage.md]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { licenceVerdict } from "../src/features/maps/domain/boundary-sources.ts";

const here = dirname(fileURLToPath(import.meta.url));
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const manifestPath = args.get("manifest") ?? join(here, "../public/geo/manifest.json");
const out = args.get("out") ?? join(here, "../../../memorybank/imp/phase41-coverage.md");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const LEVEL = { 2: "districts (admin 2)", 3: "sub-districts (admin 3)", 4: "wards, parishes, communes (admin 4)" };
const rows = manifest.countries.flatMap((c) => c.files.map((f) => ({
  iso: c.iso, country: c.name, level: f.level, units: f.units,
  maker: f.source ?? c.source, licence: f.licence ?? c.licence, year: f.yearRepresented ?? c.yearRepresented,
  origin: f.origin ?? "geoBoundaries (credit not yet recorded per file)", shareAlike: f.shareAlike === true || licenceVerdict(f.licence ?? c.licence) === "SHARE_ALIKE",
})));
const countriesAt = (level) => rows.filter((r) => r.level === level);
const bySource = (level) => { const m = new Map(); for (const r of countriesAt(level)) m.set(r.origin, (m.get(r.origin) ?? 0) + 1); return [...m].map(([k, v]) => `${k}: ${v}`).join("; "); };
const lines = [];
lines.push("# Boundary coverage", "", `Generated ${new Date().toISOString().slice(0, 10)} from \`${manifestPath.replace(/^.*apps\//, "apps/")}\` by \`apps/web/scripts/build-coverage-report.mjs\`. Provinces (admin 1) are Natural Earth (public domain), served as one small file per country under \`/geo/ADM1/\`.`, "");
lines.push("## How many countries have each level", "", "| Level | Countries | Made by |", "|---|---|---|");
for (const level of [2, 3, 4]) lines.push(`| ${LEVEL[level]} | ${countriesAt(level).length} | ${bySource(level) || "-"} |`);
lines.push("", `${manifest.countries.length} countries in the catalogue. ${rows.filter((r) => r.shareAlike).length} files are share-alike (ODbL or CC BY-SA): they ship with their credit and an offered derived copy (see \`/maps/sources\`).`, "");
for (const level of [4, 3, 2]) {
  lines.push(`## ${LEVEL[level]}`, "", "| Country | Units | Made by | Licence | Year | Share-alike |", "|---|---:|---|---|---|---|");
  for (const r of countriesAt(level).sort((a, b) => a.country.localeCompare(b.country))) lines.push(`| ${r.country} (${r.iso}) | ${r.units} | ${r.maker} | ${r.licence} | ${r.year} | ${r.shareAlike ? "yes" : ""} |`);
  lines.push("");
}
lines.push("## Held back (not shipped)", "", "A file is held when its licence is \"other\", unknown, or needs a person's decision. It is listed here so the gap is visible.", "");
if ((manifest.held ?? []).length === 0) lines.push("Nothing is held.");
else { lines.push("| Country | Level | Licence |", "|---|---:|---|"); for (const h of manifest.held) lines.push(`| ${h.name} (${h.iso}) | ${h.level} | ${h.licence || "none stated"} |`); }
lines.push("", "## Honest limits", "", "- Admin 4 exists only where an open source publishes it; a country without it stops at the finest level in its row above, and the map says so (\"Finest boundaries available for ...\").", "- Boundaries are simplified for drawing (about 100 m at admin 2 and 3, about 10 m at admin 4). They are for finding where work happens, not for surveying or settling a border.", "- An organisation can upload its own boundaries for a country and level (Settings); those are shown only to that organisation.", "");
writeFileSync(out, lines.join("\n"));
console.log(`wrote ${out}: ${rows.length} files, ${countriesAt(4).length} countries with admin 4`);
