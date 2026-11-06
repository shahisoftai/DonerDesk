import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LAYERS, buildExplorerModel, colorFor, drillInto, drillUp, levelForView, mapSummary, moveLayer, withDepth, NO_DATA_COLOR,
  numericValue, placeForRegion, placePanel, scaleBands, setLayerOpacity, toggleLayer,
} from "../../src/features/maps/domain/map-explorer.ts";
import { explorerOption } from "../../src/features/maps/domain/map-option.ts";

const place = (id: string, name: string, adminLevel: number, extra: Record<string, unknown> = {}) => ({
  id, name, kind: "AREA" as const, adminLevel, path: name, aliases: [], archived: false, childCount: 0, ...extra,
});
const places = [
  place("c", "Sudan", 0),
  place("s1", "White Nile", 1, { parentId: "c", path: "White Nile › Sudan", latitude: 13.1, longitude: 32.6 }),
  place("s2", "Gezira", 1, { parentId: "c", path: "Gezira › Sudan" }),
  { ...place("s3", "Kassala", 1, { parentId: "c", path: "Kassala › Sudan" }), kind: "POINT" as const },
];
const row = (placeId: string, name: string, value: string | null) => ({ placeId, name, path: `${name} › Sudan`, adminLevel: 1, value, verified: true, unverified: 0, contributors: 1, listedBelow: 1, partly: false });
const results = {
  level: 1, levelsAvailable: [0, 1], noPlaces: false, withoutLocation: [],
  indicators: [{ id: "i1", code: "A1", name: "People reached", unit: "people", type: "NUMBER", isRate: false,
    rollup: { level: 1, additive: true, rows: [row("s1", "White Nile", "1,200"), row("s2", "Gezira", null), row("s3", "Kassala", "300")], unplaced: [] } }],
};

test("a missing value is never 0", () => {
  assert.equal(numericValue(""), null);
  assert.equal(numericValue(null), null);
  assert.equal(numericValue("1,200.5"), 1200.5);
  assert.equal(colorFor(null, scaleBands([1, 2])), NO_DATA_COLOR);
});

test("scale bands cover the reported range, one value gives one band", () => {
  const bands = scaleBands([0, 100]);
  assert.equal(bands[0]!.from, 0);
  assert.equal(bands[bands.length - 1]!.to, 100);
  assert.equal(scaleBands([5]).length, 1);
  assert.deepEqual(scaleBands([]), []);
});

test("the model pins what has a pin, lists a pointless point apart and keeps gaps as gaps", () => {
  const model = buildExplorerModel(results, places, "i1")!;
  assert.equal(model.pins.length, 1);
  assert.equal(model.unmapped.map((u) => u.name).join(), "Kassala");
  assert.equal(model.regions.find((r) => r.name === "Gezira")!.value, null);
  assert.match(mapSummary(model), /2 of 3 places have a figure/);
  assert.equal(buildExplorerModel(results, places, "nope"), null);
});

test("the option colours a boundary from the model and greys one nobody reported", () => {
  const model = buildExplorerModel(results, places, "i1")!;
  const option = explorerOption({ model, layers: DEFAULT_LAYERS, view: drillInto("Sudan"), featureNames: ["White Nile", "Gezira", "Unknown"], unit: "people", selectedPlaceId: null }) as any;
  const byName = Object.fromEntries(option.geo.regions.map((r: any) => [r.name, r.itemStyle.areaColor]));
  assert.notEqual(byName["White Nile"], NO_DATA_COLOR);
  assert.equal(byName["Gezira"], NO_DATA_COLOR);
  assert.equal(byName["Unknown"], NO_DATA_COLOR);
  assert.equal(option.geo.map, "donordesk-drill");
  const hidden = explorerOption({ model, layers: toggleLayer(DEFAULT_LAYERS, "SYMBOLS"), view: drillUp(drillInto("Sudan")), featureNames: [], unit: null, selectedPlaceId: null }) as any;
  assert.equal(hidden.series.length, 0);
});

test("layers toggle, clamp opacity and reorder without touching the others", () => {
  assert.equal(toggleLayer(DEFAULT_LAYERS, "FILL")[0]!.visible, false);
  assert.equal(setLayerOpacity(DEFAULT_LAYERS, "FILL", 5)[0]!.opacity, 1);
  assert.equal(setLayerOpacity(DEFAULT_LAYERS, "FILL", 0)[0]!.opacity, 0.1);
  assert.equal(moveLayer(DEFAULT_LAYERS, "FILL", "UP")[1]!.id, "FILL");
  assert.deepEqual(moveLayer(DEFAULT_LAYERS, "FILL", "DOWN"), [...DEFAULT_LAYERS]);
});

test("drilling picks the level the list really has", () => {
  assert.equal(levelForView(drillInto("Sudan"), [0, 1, 2]), 1);
  assert.equal(levelForView(drillInto("Sudan"), [0, 2]), 2);
  assert.equal(levelForView({ kind: "WORLD" }, [1, 2]), 1);
  assert.deepEqual(drillInto("  "), { kind: "WORLD" });
  assert.equal(levelForView(withDepth(drillInto("Sudan"), 2), [0, 1, 2]), 2);
  assert.equal(levelForView(withDepth(drillInto("Sudan"), 3), [0, 1, 2]), 2);
  assert.deepEqual(withDepth({ kind: "WORLD" }, 2), { kind: "WORLD" });
});

test("a click on a boundary finds its place and the panel lists children and figures", () => {
  assert.equal(placeForRegion("White Nile", places, 1)?.id, "s1");
  const panel = placePanel("c", places, results, "i1")!;
  assert.equal(panel.children.length, 3);
  assert.equal(panel.children.find((c) => c.name === "Gezira")!.display, null);
  assert.equal(placePanel("s1", places, results, "i1")!.figures[0]!.display, "1,200");
  assert.equal(placePanel("zzz", places, results, "i1"), null);
});

import { nextPlayStep, periodSteps, stepIndex } from "../../src/features/maps/domain/period-steps.ts";
test("the time slider has an all-periods step and plays through periods only", () => {
  const steps = periodSteps([{ id: "a", label: "Q1" }, { id: "b", label: "Q2" }]);
  assert.equal(steps.length, 3);
  assert.equal(stepIndex(steps, null), 0);
  assert.equal(stepIndex(steps, "b"), 2);
  assert.equal(stepIndex(steps, "zzz"), 0);
  assert.equal(nextPlayStep(steps, 0), 1);
  assert.equal(nextPlayStep(steps, 2), 1);
  assert.equal(nextPlayStep(periodSteps([]), 0), 0);
});

import { panelPeriods, sharedBands, withBands } from "../../src/features/maps/domain/map-explorer.ts";
test("small multiples share one scale across panels and show the latest periods only", () => {
  const a = buildExplorerModel(results, places, "i1")!;
  const bigger = { ...results, indicators: [{ ...results.indicators[0]!, rollup: { ...results.indicators[0]!.rollup, rows: [row("s1", "White Nile", "5,000")] } }] };
  const b = buildExplorerModel(bigger, places, "i1")!;
  const bands = sharedBands([a, b]);
  assert.equal(bands[bands.length - 1]!.to, 5000);
  assert.deepEqual(withBands(a, bands).bands, bands);
  assert.deepEqual(panelPeriods([1, 2, 3, 4, 5, 6, 7, 8], 6), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(panelPeriods([1, 2], 6), [1, 2]);
});

import { overlaySeries, parseOverlay } from "../../src/features/maps/domain/overlay-layer.ts";
test("an uploaded GeoJSON is validated before it is drawn", () => {
  const fc = (geometry: unknown) => JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "A" }, geometry }] });
  const pt = parseOverlay(fc({ type: "Point", coordinates: [32, 15] }), "f");
  assert.ok(pt.ok && pt.overlay.points.length === 1);
  const poly = parseOverlay(fc({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }), "f");
  assert.ok(poly.ok && poly.overlay.lines.length === 1);
  assert.equal(overlaySeries((poly as any).overlay, 0.5).length, 1);
  assert.equal(parseOverlay("nope", "f").ok, false);
  assert.equal(parseOverlay(JSON.stringify({ type: "FeatureCollection", features: [] }), "f").ok, false);
  assert.equal(parseOverlay(fc({ type: "Point", coordinates: [500, 15] }), "f").ok, false);
  assert.equal(parseOverlay("x".repeat(5_000_001), "f").ok, false);
});
