import { test } from "node:test";
import assert from "node:assert/strict";
import { attributionLine, fileFor, findCountry, levelsFor, licenceVerdict, requiresShareAlike, roundGeometry, type BoundaryManifest } from "../../src/features/maps/domain/boundary-sources.ts";

test("attribution and public-domain licences ship; ODbL and CC BY-SA ship with a share-alike obligation; 'other' and unknown are held", () => {
  for (const l of ["Public Domain", "Creative Commons Attribution 4.0 International (CC BY 4.0)", "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)", "Etalab Open License 2.0", "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication", "Open Government Licence v3.0"]) {
    assert.equal(licenceVerdict(l), "SHIP", l);
    assert.equal(requiresShareAlike(l), false, l);
  }
  for (const l of ["Open Data Commons Open Database License 1.0", "Creative Commons Attribution-ShareAlike 2.0", "Creative Commons Attribution-ShareAlike 3.0 Unported"]) {
    assert.equal(licenceVerdict(l), "SHARE_ALIKE", l);
    assert.equal(requiresShareAlike(l), true, l);
  }
  for (const l of ["Other - Direct Permission", "", undefined]) assert.equal(licenceVerdict(l as string), "HOLD", String(l));
});

const manifest: BoundaryManifest = {
  generatedAt: "2026-10-29", dataset: "geoBoundaries gbOpen", attribution: "x",
  countries: [{ iso: "SDN", name: "Sudan", source: "OCHA", licence: "CC BY 3.0 IGO", yearRepresented: "2020", files: [{ level: 2, file: "SDN/ADM2.json", units: 189, bytes: 1 }, { level: 3, file: "SDN/ADM3.json", units: 2, bytes: 1 }] }],
  held: [],
};
test("a country is found by name or code, with its levels and file", () => {
  assert.equal(findCountry(manifest, "sudan")?.iso, "SDN");
  assert.equal(findCountry(manifest, "SDN")?.name, "Sudan");
  assert.equal(findCountry(manifest, "Narnia"), null);
  assert.deepEqual(levelsFor(findCountry(manifest, "Sudan")), [2, 3]);
  assert.equal(fileFor(findCountry(manifest, "Sudan"), 2)?.file, "SDN/ADM2.json");
  assert.equal(fileFor(findCountry(manifest, "Sudan"), 1), null);
  assert.match(attributionLine(manifest.countries[0]!), /geoBoundaries/);
});

test("rounding touches coordinates only", () => {
  const out = roundGeometry({ type: "Polygon", coordinates: [[[32.123456, 15.987654]]], id: 1.23456 }) as any;
  assert.deepEqual(out.coordinates, [[[32.123, 15.988]]]);
  assert.equal(out.id, 1.23456);
});

import { HUMANITARIAN_COUNTRIES, isHumanitarianCountry } from "../../src/features/maps/domain/humanitarian-countries.ts";
test("the humanitarian country list is ISO3, has no duplicates and covers the main response settings", () => {
  assert.ok(HUMANITARIAN_COUNTRIES.every((c) => /^[A-Z]{3}$/.test(c)));
  assert.equal(new Set(HUMANITARIAN_COUNTRIES).size, HUMANITARIAN_COUNTRIES.length);
  for (const iso of ["SDN", "SSD", "SOM", "YEM", "SYR", "AFG", "UKR", "HTI", "COD", "MMR"]) assert.ok(isHumanitarianCountry(iso), iso);
  assert.equal(isHumanitarianCountry("sdn"), true);
  assert.equal(isHumanitarianCountry("NOR"), false);
});

import { codFileName, geojsonZipUrl, readLevel, unitName } from "../../src/features/maps/domain/ocha-cod.ts";
test("OCHA files: the zip is found, names are read in order, replaced boundaries are left out", () => {
  assert.equal(geojsonZipUrl({ resources: [{ format: "SHP", download_url: "a" }, { format: "GeoJSON", download_url: "b" }] }), "b");
  assert.equal(geojsonZipUrl({ resources: [] }), null);
  assert.equal(codFileName("SDN", 2), "sdn_admin2.geojson");
  assert.equal(unitName({ adm2_name: " ", adm2_name1: "الخرطوم" }, 2), "الخرطوم");
  const g = { type: "Polygon", coordinates: [] };
  const r = readLevel([
    { properties: { adm2_name: "Old", adm2_pcode: "X1", valid_to: "2019-01-01" }, geometry: g },
    { properties: { adm2_name: "New", adm2_pcode: "X2", valid_on: "2024-05-01T00:00:00" }, geometry: g },
    { properties: { adm2_name: "", adm2_pcode: "X3" }, geometry: g },
    { properties: { adm2_name: "Shapeless" } },
  ], 2, "2026-10-29");
  assert.deepEqual(r.features.map((f) => f.properties.name), ["New"]);
  assert.deepEqual(r.skipped, { noName: 1, replaced: 1, noShape: 1 });
  assert.equal(r.version, "2024-05-01");
});
test("the footer credits the file's own origin", () => {
  const c = { ...manifest.countries[0]!, files: [{ level: 2 as const, file: "x", units: 1, bytes: 1, origin: "OCHA COD-AB" as const, source: "OCHA", licence: "CC BY-IGO", yearRepresented: "2024" }, { level: 3 as const, file: "y", units: 1, bytes: 1 }] };
  assert.match(attributionLine(c, 2), /OCHA COD-AB/);
  assert.match(attributionLine(c, 3), /geoBoundaries/);
});

import { simplifyGeometry, simplifyLine } from "../../src/features/maps/domain/simplify-geometry.ts";
test("simplification drops near-straight points, keeps corners, and never leaves a ring under four points", () => {
  assert.equal(simplifyLine([[0, 0], [1, 0.0001], [2, 0], [2, 2]], 0.01).length, 3);
  const ring = [[0, 0], [5, 0.001], [10, 0], [10, 10], [0, 10], [0, 0]] as const;
  const sq = simplifyGeometry({ type: "Polygon", coordinates: [ring] }, 0.01) as any;
  assert.equal(sq.coordinates[0].length, 5);
  assert.equal(simplifyGeometry({ type: "Polygon", coordinates: [[[0, 0], [0.001, 0], [0, 0.001], [0, 0]]] }, 1), null);
  const long = Array.from({ length: 200000 }, (_, i) => [i, 0] as [number, number]);
  assert.equal(simplifyLine(long, 0.1).length, 2);
});

import { sourcesPageRows } from "../../src/features/maps/domain/boundary-sources.ts";
test("the sources page lists every shipped file with its credit, and marks share-alike files", () => {
  const m: BoundaryManifest = {
    generatedAt: "x", dataset: "geoBoundaries gbOpen", attribution: "x", held: [],
    countries: [
      { iso: "UGA", name: "Uganda", source: "OCHA COD-AB", licence: "CC BY 3.0 IGO", yearRepresented: "2024", files: [{ level: 3, file: "UGA/ADM3.json", units: 1, bytes: 1 }] },
      { iso: "ALB", name: "Albania", source: "geoBoundaries", licence: "Open Data Commons Open Database License 1.0", yearRepresented: "2014", files: [{ level: 2, file: "ALB/ADM2.json", units: 1, bytes: 1, shareAlike: true }] },
    ],
  };
  const rows = sourcesPageRows(m);
  assert.deepEqual(rows.map((r) => r.iso), ["ALB", "UGA"]);
  assert.equal(rows[0]!.shareAlike, true);
  assert.equal(rows[1]!.shareAlike, false);
  assert.equal(rows[1]!.source, "OCHA COD-AB");
});

import { parentCode } from "../../src/features/maps/domain/ocha-cod.ts";
test("admin 4: finer rounding keeps units apart, and a unit carries its parent's code", () => {
  const g = { type: "Polygon", coordinates: [[[32.123456, 15.987654]]] };
  assert.deepEqual((roundGeometry(g, 4) as any).coordinates, [[[32.1235, 15.9877]]]);
  assert.deepEqual((roundGeometry(g) as any).coordinates, [[[32.123, 15.988]]]);
  assert.equal(parentCode({ adm3_pcode: "UG0101" }, 4), "UG0101");
  assert.equal(parentCode({ adm1_pcode: "UG01" }, 1), "");
  const r = readLevel([{ properties: { adm4_name: "Kisenyi", adm4_pcode: "UG010101", adm3_pcode: "UG0101" }, geometry: { type: "Polygon", coordinates: [] } }], 4, "2026-11-03");
  assert.deepEqual(r.features[0]!.properties, { name: "Kisenyi", id: "UG010101", parentId: "UG0101" });
});

test("a file with no credit of its own never borrows the country's, which may describe another file", () => {
  const c = { ...manifest.countries[0]!, source: "UNHCR", licence: "CC BY 3.0 IGO", files: [{ level: 4 as const, file: "z", units: 1, bytes: 1 }] };
  const line = attributionLine(c, 4);
  assert.doesNotMatch(line, /UNHCR|IGO/);
  assert.match(line, /geoBoundaries/);
  const own = { ...c, files: [{ level: 4 as const, file: "z", units: 1, bytes: 1, origin: "geoBoundaries" as const, source: "Survey Dept", licence: "CC BY 4.0", yearRepresented: "2022" }] };
  assert.match(attributionLine(own, 4), /Survey Dept \(2022\), CC BY 4\.0/);
});
