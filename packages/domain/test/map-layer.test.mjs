import test from "node:test";
import assert from "node:assert/strict";
import { PlannedActivity, validateMapLayer, MAP_LAYER_MAX_BYTES } from "../dist/index.js";

const VALID_LAYER = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "North District" }, geometry: { type: "Polygon", coordinates: [[[30, 1], [31, 1], [31, 2], [30, 2], [30, 1]]] } },
    { type: "Feature", properties: { name: "South District" }, geometry: { type: "Polygon", coordinates: [[[30, -2], [31, -2], [31, -1], [30, -1], [30, -2]]] } },
  ],
};

function createPin(over = {}) {
  const created = PlannedActivity.create({
    id: "pa1", tenantId: "t", projectId: "p", title: "Field visit", plannedStart: "2026-11-02", plannedEnd: "2026-11-02",
    createdById: "u", latitude: 30.12, longitude: 31.5, ...over,
  });
  if (!created.ok) return created;
  return created;
}

test("a valid GeoJSON FeatureCollection passes with its name and feature count", () => {
  const r = validateMapLayer(JSON.stringify(VALID_LAYER), { fileName: "pakistan-districts.geojson" });
  assert.ok(r.ok);
  assert.equal(r.value.featureCount, 2);
  assert.equal(r.value.name, "pakistan-districts");
  assert.equal(JSON.parse(r.value.json).type, "FeatureCollection");
});

test("a file that is not a FeatureCollection is refused, plainly", () => {
  const array = validateMapLayer(JSON.stringify([VALID_LAYER.features[0]]), {});
  assert.equal(array.ok, false);
  assert.match(array.error?.message ?? "", /GeoJSON FeatureCollection/);
  const broken = validateMapLayer("{not json", {});
  assert.equal(broken.ok, false);
  assert.match(broken.error?.message ?? "", /not valid JSON/);
});

test("a feature with no geometry names itself in the refusal", () => {
  const bad = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Empty" }, geometry: null }] };
  const r = validateMapLayer(JSON.stringify(bad), {});
  assert.equal(r.ok, false);
  assert.match(r.error?.message ?? "", /\("Empty"\)/);
});

test("an oversized file is refused before parsing", () => {
  const huge = JSON.stringify(VALID_LAYER) + " ".repeat(MAP_LAYER_MAX_BYTES + 1);
  const r = validateMapLayer(huge, {});
  assert.equal(r.ok, false);
  assert.match(r.error?.message ?? "", /too large/);
});

test("a pinned place needs both coordinates, in range", () => {
  assert.equal(createPin({ latitude: undefined, longitude: undefined }).ok, true, "no pin at all is fine");
  const half = createPin({ latitude: 30.12, longitude: undefined });
  assert.equal(half.ok, false);
  assert.equal(half.error?.details?.field, "latitude");
  const outOfRange = createPin({ latitude: 95, longitude: 31 });
  assert.equal(outOfRange.ok, false);
  assert.match(outOfRange.error?.message ?? "", /Latitude/);
  const badLng = createPin({ latitude: 30, longitude: 500 });
  assert.equal(badLng.ok, false);
  assert.match(badLng.error?.message ?? "", /Longitude/);
});

test("a pinned place round-trips and is cleared by an empty patch", () => {
  const created = createPin();
  assert.ok(created.ok);
  const item = created.value;
  assert.equal(item.snapshot().latitude, 30.12);
  const cleared = item.updateDetails({ latitude: undefined, longitude: undefined }, { today: "2026-10-24", reportUsesIt: false });
  assert.ok(cleared.ok);
  assert.equal(item.snapshot().latitude, undefined);
  assert.equal(item.snapshot().longitude, undefined);
});

test("latitude out of range is refused on update too", () => {
  const created = createPin();
  assert.ok(created.ok);
  const r = created.value.updateDetails({ latitude: 120, longitude: 31 }, { today: "2026-10-24", reportUsesIt: false });
  assert.equal(r.ok, false);
});
