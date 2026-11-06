import assert from "node:assert/strict";
import test from "node:test";
import { placesToGeoJson, placesToKml, splitPinned } from "../dist/index.js";

const places = [
  { name: 'Rabak <"main">', path: "Rabak › White Nile › Sudan", level: 2, value: 120.5, partly: true, latitude: 13.2, longitude: 32.7 },
  { name: "Kosti & co", path: "Kosti › Sudan", level: 2, value: null, partly: false, latitude: 13.1, longitude: 32.6 },
  { name: "Atlantis", path: "Atlantis", level: 0, value: 50, partly: false },
  { name: "Nowhere", path: "Nowhere", level: 0, value: null, partly: false },
];
const o = { title: "OUT-1 by place", valueLabel: "People trained", unit: "people" };

test("only pinned places go in a file; a place with a value and no pin is reported, one with neither is not", () => {
  const s = splitPinned(places);
  assert.deepEqual(s.pinned.map((p) => p.name), ['Rabak <"main">', "Kosti & co"]);
  assert.deepEqual(s.unpinned.map((p) => p.name), ["Atlantis"]);
});

test("GeoJSON puts longitude first, keeps a missing value null (never 0) and says what the value is", () => {
  const g = JSON.parse(placesToGeoJson(places, o));
  assert.equal(g.type, "FeatureCollection");
  assert.equal(g.features.length, 2);
  assert.deepEqual(g.features[0].geometry.coordinates, [32.7, 13.2]);
  assert.equal(g.features[0].properties["People trained"], 120.5);
  assert.equal(g.features[0].properties.unit, "people");
  assert.equal(g.features[0].properties.partlyReported, true);
  assert.equal(g.features[1].properties["People trained"], null);
  assert.deepEqual(JSON.parse(placesToGeoJson([], o)).features, []);
});

test("KML escapes every text, writes longitude then latitude, and says when nothing is recorded", () => {
  const k = placesToKml(places, o);
  assert.match(k, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(k, /<name>Rabak &lt;&quot;main&quot;&gt;<\/name>/);
  assert.match(k, /<name>Kosti &amp; co<\/name>/);
  assert.match(k, /<coordinates>32.7,13.2,0<\/coordinates>/);
  assert.match(k, /People trained: 120.5 people\. Rabak › White Nile › Sudan\. Partly reported\./);
  assert.match(k, /People trained: no value recorded\./);
  assert.equal((k.match(/<Placemark>/g) ?? []).length, 2);
  assert.doesNotMatch(k, /Atlantis/);
  assert.match(placesToKml([], { ...o, title: "A & B" }), /<name>A &amp; B<\/name>/);
});
