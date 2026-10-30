import test from "node:test";
import assert from "node:assert/strict";
import { validateOverlay, MAP_OVERLAY_MAX_FEATURES } from "../dist/index.js";

const fc = (...geoms) => JSON.stringify({ type: "FeatureCollection", features: geoms.map((geometry, i) => ({ type: "Feature", properties: { name: `f${i}`, secret: "x" }, geometry })) });

test("an overlay keeps what can be drawn, drops a shape with a coordinate out of range, and keeps only its name", () => {
  const r = validateOverlay(fc({ type: "LineString", coordinates: [[32.5, 13.1], [32.6, 13.2]] }, { type: "Point", coordinates: [200, 10] }, { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] }), "Rivers.geojson");
  assert.equal(r.ok, true);
  assert.equal(r.value.name, "Rivers");
  assert.equal(r.value.featureCount, 2);
  const out = JSON.parse(r.value.json);
  assert.deepEqual(out.features.map((f) => f.properties), [{ name: "f0" }, { name: "f2" }], "other properties are not stored");
});

test("nothing drawable, a bad file, a missing name or too many features are refused with a sentence", () => {
  assert.match(validateOverlay(fc({ type: "Point", coordinates: [0, 95] }), "x").error.message, /nothing to draw/);
  assert.match(validateOverlay("not json", "x").error.message, /could not be read/);
  assert.match(validateOverlay(fc({ type: "Point", coordinates: [1, 1] }), "  ").error.message, /name/);
  const many = JSON.stringify({ type: "FeatureCollection", features: Array.from({ length: MAP_OVERLAY_MAX_FEATURES + 1 }, () => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 1] } })) });
  assert.match(validateOverlay(many, "x").error.message, /more than/);
});
