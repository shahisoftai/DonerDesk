import assert from "node:assert/strict";
import test from "node:test";
import { areaLabel, bandColour, categoryColours } from "../../src/features/maps/domain/scene/area-style.ts";
import { calloutAnchors } from "../../src/features/maps/domain/scene/callout-anchors.ts";
import { buildResultsScene } from "../../src/features/maps/domain/scene/build-scene.ts";
import { DEFAULT_LAYERS } from "../../src/features/maps/domain/map-explorer.ts";
import { buildMapLibreLayers as buildLayers } from "../../src/features/maps/adapters/maplibre/layers.ts";

const square = (x: number, y: number) => ({ type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] });
const unit = (ref: string, name: string, parent: string, x: number) => ({ unit: { ref, name, pcode: ref, parentPcode: parent, geometry: square(x, 0) }, placeId: name.toLowerCase(), basis: "CODE" as const });
const joined = [unit("NP-1", "Humla", "NP-K", 0), unit("NP-2", "Jumla", "NP-K", 1), unit("NP-3", "Doti", "NP-S", 2)];
const model = { indicatorId: "i", level: 2, pins: [], unmapped: [], bands: [], isRate: false, regions: [{ placeId: "humla", value: 10, display: "10", path: "Humla", verified: true }, { placeId: "jumla", value: null, display: null, path: "Jumla", verified: true }] } as never;

test("a gap is grey in every colouring; bands are low to high; categories are stable", () => {
  const bands = [{ from: null, to: 5, color: "#ff0000" }, { from: 5, to: null, color: "#00ff00" }];
  assert.equal(bandColour(null, bands, "#ccc"), "#ccc");
  assert.equal(bandColour(5, bands, "#ccc"), "#00ff00");
  const a = categoryColours(["b", "a", "b"], ["#1", "#2"]); const b = categoryColours(["a", "b"], ["#1", "#2"]);
  assert.deepEqual([...a], [...b]);
  assert.equal(areaLabel("NAME_AND_VALUE", "Humla", null), "Humla");
  assert.equal(areaLabel("VALUE", "Humla", null), undefined);
});

test("a district map coloured by province gives districts of one province one colour, and labels reach the layer", () => {
  const scene = buildResultsScene({ model, layers: DEFAULT_LAYERS, joined: joined as never, unit: null, selectedRef: null, selectedPlaceId: null, basemap: "plain", label: "m", areaStyle: { colorBy: "CATEGORY", byParent: true, palette: ["#111111", "#222222"], labels: "NAME" } });
  const fill = scene.layers.find((l) => l.kind === "FILL") as { features: Array<{ ref: string; color: string; label?: string }>; labels?: boolean };
  const col = new Map(fill.features.map((f) => [f.ref, f.color]));
  assert.equal(col.get("NP-1"), col.get("NP-2"));
  assert.notEqual(col.get("NP-1"), col.get("NP-3"));
  assert.equal(fill.labels, true);
  assert.equal(fill.features[0]!.label, "Humla");
  const built = buildLayers(scene, false);
  assert.ok(built.layers.some((l) => l.id === "dd-area-labels"));
});

test("a figure card points at its place's pin, else the middle of its area, and is never placed at a guess", () => {
  const places = [{ id: "humla", name: "Humla", latitude: 30, longitude: 81 }, { id: "doti", name: "Doti" }];
  const r = calloutAnchors([{ key: "humla" }, { key: "doti" }, { key: "nowhere" }], places, joined as never);
  assert.deepEqual(r.placed.map((p) => [p.key, p.lng, p.lat]), [["humla", 81, 30], ["doti", 2.5, 0.5]]);
  assert.equal(r.unplaced, 1);
});

test("a district with no pin and no drawn area points at the middle of the pinned sites inside it", () => {
  const places = [{ id: "j", name: "Jumla" }, { id: "s1", name: "Site A", parentId: "j", latitude: 29, longitude: 82 }, { id: "s2", name: "Site B", parentId: "j", latitude: 30, longitude: 84 }, { id: "x", name: "Empty" }];
  const r = calloutAnchors([{ key: "jumla" }, { key: "empty" }], places, []);
  assert.deepEqual(r.placed.map((p) => [p.key, p.lng, p.lat]), [["jumla", 83, 29.5]]);
  assert.equal(r.unplaced, 1);
});
