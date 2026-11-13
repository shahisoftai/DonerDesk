import assert from "node:assert/strict";
import test from "node:test";
import { MAP_PRESETS, MAP_PRESET_IDS, resolveMapLook } from "../../src/features/maps/domain/map-presets.ts";
import { AUTO_LABEL_LIMIT, resolveLabels } from "../../src/features/maps/domain/scene/area-style.ts";
import { DEFAULT_GROUND, NEW_MAP_GROUND } from "../../src/features/maps/domain/ground.ts";
import { HOME_COUNTRY_RULES, homeCountry, homeCountryOf } from "../../src/features/maps/domain/drill/home-country.ts";

const place = (name: string, adminLevel = 0) => ({ name, adminLevel, archived: false });

test("every preset is complete and the report look is the sober one", () => {
  for (const id of MAP_PRESET_IDS) {
    const p = MAP_PRESETS[id];
    assert.equal(p.id, id);
    assert.ok(p.ground && p.colorBy && p.labels && typeof p.legend === "boolean");
  }
  assert.equal(DEFAULT_GROUND, "SIMPLE");
  assert.equal(NEW_MAP_GROUND, "SIMPLE");
  assert.equal(MAP_PRESETS.REPORT.legend, true);
});

test("a saved field wins, an unknown one falls back to the preset", () => {
  assert.deepEqual(resolveMapLook(undefined), { ground: "SIMPLE", colorBy: "VALUE", labels: "AUTO", legend: true });
  assert.equal(resolveMapLook({ ground: "NONE" }).ground, "NONE");
  assert.equal(resolveMapLook({ ground: "nonsense" }).ground, "SIMPLE");
  assert.equal(resolveMapLook({ labels: "NAME" }).labels, "NAME");
  assert.equal(resolveMapLook({ legend: false }).legend, false);
});

test("automatic labels print name and figure up to the limit, then none", () => {
  assert.equal(resolveLabels("AUTO", AUTO_LABEL_LIMIT), "NAME_AND_VALUE");
  assert.equal(resolveLabels(undefined, 1), "NAME_AND_VALUE");
  assert.equal(resolveLabels("AUTO", AUTO_LABEL_LIMIT + 1), "NONE");
  assert.equal(resolveLabels("NAME", 500), "NAME");
  assert.equal(resolveLabels("NONE", 3), "NONE");
});

test("the home country chain: one country place, results, then the project's country; never a guess", () => {
  assert.equal(HOME_COUNTRY_RULES.length, 3);
  assert.equal(homeCountry([place("Kenya")], null), "Kenya");
  assert.equal(homeCountry([place("Kenya"), place("Uganda")], null), null);
  assert.equal(homeCountryOf({ places: [place("Kenya"), place("Uganda")], results: null, projectCountry: "uganda" }), "Uganda");
  assert.equal(homeCountryOf({ places: [], results: null, projectCountry: "Nepal", knownCountries: ["Nepal"] }), "Nepal");
  assert.equal(homeCountryOf({ places: [], results: null, projectCountry: "Atlantis", knownCountries: ["Nepal"] }), null);
  assert.equal(homeCountryOf({ places: [], results: null, projectCountry: "" }), null);
});

test("by-place entry and the map's empty state agree on the rules", async () => {
  const { canRecordByPlace, totalFromPlaces } = await import("@donordesk/domain/contexts/places/place-recording.js");
  const { mapReadiness } = await import("@donordesk/domain/contexts/places/map-readiness.js");
  assert.deepEqual(canRecordByPlace({ calculated: false }, [{ id: "a", name: "A", adminLevel: 1, archived: false }]), { ok: true, level: 1 });
  assert.equal(totalFromPlaces("NUMBER", [{ value: "2" }, { value: "3" }]), "5");
  assert.equal(mapReadiness({ placeCount: 0, indicators: [], unconfirmedLocations: 0 })?.code, "NO_PLACES");
});

test("automatic labels label only the areas that have a figure, however many areas the country has", async () => {
  const { buildResultsScene } = await import("../../src/features/maps/domain/scene/build-scene.ts");
  const { DEFAULT_LAYERS } = await import("../../src/features/maps/domain/map-explorer.ts");
  const sq = (x: number) => ({ type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] });
  const joined = Array.from({ length: 60 }, (_, i) => ({ unit: { ref: `R${i}`, name: `Area ${i}`, pcode: `R${i}`, parentPcode: "", geometry: sq(i) }, placeId: `p${i}`, basis: "CODE" as const }));
  const model = { indicatorId: "i", level: 1, pins: [], unmapped: [], bands: [], isRate: false, regions: [{ placeId: "p0", value: 5, display: "5", path: "A", verified: true }] } as never;
  const scene = buildResultsScene({ model, layers: DEFAULT_LAYERS, joined: joined as never, unit: null, selectedRef: null, selectedPlaceId: null, basemap: "plain", label: "m" });
  const fill = scene.layers.find((l) => l.kind === "FILL") as { features: Array<{ label?: string }>; labels?: boolean };
  assert.equal(fill.labels, true);
  assert.deepEqual(fill.features.map((f) => f.label).filter(Boolean), ["Area 0\n5"]);
});
