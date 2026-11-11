import assert from "node:assert/strict";
import test from "node:test";
import { parsePlaceSheet, placeListToCsv, placeListToGeoJson, placeResultsToCsv, placeResultsToGeoJson } from "../dist/index.js";

const places = [
  { id: "c", name: "Sudan", adminLevel: 0, path: "Sudan", code: "SD", aliases: [] },
  { id: "s", name: "White Nile", adminLevel: 1, path: "White Nile › Sudan", parentId: "c", code: "SD07", aliases: ["Al Nil al Abyad"] },
  { id: "r", name: "Rabak, \"old town\"", adminLevel: 2, path: "Rabak › White Nile › Sudan", parentId: "s", aliases: [], latitude: 13.18, longitude: 32.74, facility: true },
  { id: "x", name: "=HYPERLINK(1)", adminLevel: 2, path: "x", parentId: "s", aliases: [] },
  { id: "gone", name: "Retired", adminLevel: 2, path: "Retired", parentId: "s", aliases: [], archived: true },
];

test("places CSV: the places import reads back every live place with its level, parent, code, pin and spellings", () => {
  const { rows, problems } = parsePlaceSheet(placeListToCsv(places));
  assert.deepEqual(problems, []);
  assert.deepEqual(rows.map((r) => r.name), ["Sudan", "White Nile", "Rabak, \"old town\"", "'=HYPERLINK(1)"]);
  const rabak = rows.find((r) => r.name.startsWith("Rabak"));
  assert.equal(rabak.adminLevel, 2);
  assert.equal(rabak.parentName, "White Nile");
  assert.equal(rabak.latitude, 13.18);
  assert.deepEqual(rows.find((r) => r.name === "White Nile").aliases, ["Al Nil al Abyad"]);
});

test("places GeoJSON: only pinned places are features, longitude first; the rest are counted", () => {
  const { text, unpinned } = placeListToGeoJson(places);
  const g = JSON.parse(text);
  assert.equal(g.features.length, 1);
  assert.deepEqual(g.features[0].geometry.coordinates, [32.74, 13.18]);
  assert.equal(g.features[0].properties.facility, true);
  assert.equal(unpinned, 3);
});

test("results by place: a gap is empty, never 0; unverified is said; a place without a pin is counted", () => {
  const rows = [
    { placeId: "r", name: "Rabak", path: "Rabak › Sudan", latitude: 13.18, longitude: 32.74, value: 0, verified: false, period: "Jan 2026" },
    { placeId: "k", name: "Kosti", path: "Kosti › Sudan", value: null, verified: false, period: "Jan 2026" },
  ];
  const csv = placeResultsToCsv(rows, "People trained").split("\n");
  assert.equal(csv[1], "Rabak,Rabak › Sudan,,13.18,32.74,0,no,Jan 2026");
  assert.equal(csv[2], "Kosti,Kosti › Sudan,,,,,,Jan 2026");
  const geo = placeResultsToGeoJson(rows, "People trained");
  assert.equal(geo.unpinned, 1);
  assert.equal(JSON.parse(geo.text).features[0].properties["People trained"], 0);
});

test("a facility's type survives export and import (Phase 50.3b)", async () => {
  const { placeListToCsv, parsePlaceSheet } = await import("../dist/index.js");
  const csv = placeListToCsv([{ id: "n", name: "Nepal", adminLevel: 0, path: "Nepal", aliases: [] }, { id: "s", name: "Jumla OTP", adminLevel: 4, parentId: "n", path: "Jumla OTP › Nepal", aliases: [], facility: true, facilityType: "OTP" }]);
  assert.match(csv.split("\n")[0], /Facility type$/);
  const parsed = parsePlaceSheet(csv);
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.rows.find((r) => r.name === "Jumla OTP").facilityType, "OTP");
  assert.equal(parsed.rows.find((r) => r.name === "Nepal").facilityType, undefined);
});
