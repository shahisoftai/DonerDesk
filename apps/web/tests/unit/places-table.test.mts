import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlaces, placesCsv } from "../../src/features/places/domain/places-table.ts";
import { containingFeature } from "../../src/features/maps/domain/point-in-area.ts";

const p = (id: string, name: string, adminLevel: number, extra: Record<string, unknown> = {}) => ({ id, name, kind: "AREA" as const, adminLevel, path: name, aliases: [], archived: false, childCount: 0, ...extra });
const places = [p("a", "Khartoum", 1, { aliases: ["الخرطوم"], code: "SD-KH" }), p("b", "Rabak", 2, { latitude: 13.2, longitude: 32.7 }), p("c", "=Evil", 2)];

test("places filter by folded text across name, path, alias and code, by level and by pin", () => {
  assert.equal(filterPlaces(places, { query: "sd-kh", level: null, pinnedOnly: false }).length, 1);
  assert.equal(filterPlaces(places, { query: "", level: 2, pinnedOnly: false }).length, 2);
  assert.equal(filterPlaces(places, { query: "", level: null, pinnedOnly: true }).map((x) => x.id).join(), "b");
  assert.equal(filterPlaces(places, { query: "RABAK", level: null, pinnedOnly: false }).length, 1);
});
test("the CSV carries the chosen columns and defuses formulas", () => {
  const csv = placesCsv(places, ["code", "pin"], (l) => String(l));
  assert.match(csv.split("\n")[0]!, /"Name","Code","Has a pin"/);
  assert.match(csv, /"'=Evil"/);
  assert.match(csv, /"Rabak","","Yes"/);
});
const square = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
test("a point is placed inside the area that contains it, not in a hole, and bad coordinates give nothing", () => {
  const features = [{ properties: { name: "Big" }, geometry: square }];
  assert.equal(containingFeature(features, 2, 2), "Big");
  assert.equal(containingFeature(features, 5, 5), null);
  assert.equal(containingFeature(features, 20, 20), null);
  assert.equal(containingFeature(features, 95, 2), null);
  const multi = [{ properties: { name: "Islands" }, geometry: { type: "MultiPolygon", coordinates: [square.coordinates, [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]] } }];
  assert.equal(containingFeature(multi, 25, 25), "Islands");
});
