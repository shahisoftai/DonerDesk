import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMapLibreLayers, CLUSTER_PROPERTIES } from "../../src/features/maps/adapters/maplibre/layers.ts";
import { contextLayers, offeredContext } from "../../src/features/maps/domain/scene/context-layers.ts";
import type { MapScene } from "../../src/features/maps/domain/model/scene.ts";

const tile = { url: "https://app.test/geo/BGD/ADM4.pmtiles?v=1", sourceLayer: "adm4" };
const scene = (layers: MapScene["layers"]): MapScene => ({ label: "x", basemap: "plain", bounds: null, tips: {}, layers });

test("tiled boundaries: one vector source, colours by ref, only this view's refs drawn; a value never enters the tiles", () => {
  const built = buildMapLibreLayers(scene([{ kind: "FILL", opacity: 0.8, outline: true, selectedRef: "B", features: [
    { ref: "A", name: "A", color: "#111111", geometry: null, tile }, { ref: "B", name: "B", color: "#222222", geometry: null, tile },
  ] }]));
  assert.deepEqual(built.sources, [{ id: "dd-fill-src", url: `pmtiles://${tile.url}` }]);
  const fill = built.layers.find((l) => l.id === "dd-fill")!;
  assert.equal(fill["source-layer"], "adm4");
  assert.deepEqual(fill.filter, ["in", ["get", "ref"], ["literal", ["A", "B"]]]);
  assert.deepEqual((fill.paint["fill-color"] as unknown[]).slice(0, 6), ["match", ["get", "ref"], "A", "#111111", "B", "#222222"]);
});

test("context layers: drawn under the results, never pickable ids; imagery only with an address; credits travel with each layer", () => {
  const settings = { layers: ["POPULATION" as const, "HEALTH_FACILITIES" as const], imageryUrl: "https://img.test/{z}/{x}/{y}.jpg", imageryCredit: "Img Co" };
  assert.deepEqual(offeredContext(settings), ["IMAGERY", "POPULATION", "HEALTH_FACILITIES"]);
  const ctx = contextLayers(settings, new Set(["IMAGERY", "HEALTH_FACILITIES"] as const), "https://app.test");
  assert.deepEqual(ctx.map((c) => c.type), ["imagery", "points"]);
  assert.equal(ctx[0]!.attribution, "Img Co");
  const built = buildMapLibreLayers(scene([{ kind: "PINS", pins: [], opacity: 1, selectedId: null, cluster: false }, ...ctx]));
  assert.equal(built.layers[0]!.id, "dd-ctx-imagery", "imagery first, under the results");
  const ids = built.layers.map((l) => l.id);
  assert.ok(ids.indexOf("dd-ctx-health_facilities") < ids.indexOf("dd-pins"), "context points under the project's pins");
  assert.deepEqual(contextLayers(null, new Set(["POPULATION"] as const), ""), []);
});

test("clusters: carry the worst rank of their pins and take that rank's colour", () => {
  assert.deepEqual(CLUSTER_PROPERTIES, { rank: ["max", ["coalesce", ["get", "rank"], 0]] });
  const built = buildMapLibreLayers(scene([{ kind: "PINS", opacity: 1, selectedId: null, cluster: true, rankColors: ["#aaa", "#bbb", "#ccc", "#ddd"], pins: [{ id: "p", name: "p", lng: 1, lat: 1, color: "#ddd", radius: 5, rank: 3 }] }]));
  const clusters = built.layers.find((l) => l.id === "dd-clusters")!;
  assert.deepEqual((clusters.paint["circle-color"] as unknown[]).slice(0, 4), ["match", ["get", "rank"], 0, "#aaa"]);
});

import { unitForCrumb } from "../../src/features/maps/domain/drill/place-path.ts";
test("drill: a crumb finds its unit by P-code, else by a unique name (another code system), never between namesakes", () => {
  const units = [{ ref: "KE023", name: "Turkana" }, { ref: "KE030", name: "Baringo" }, { ref: "X1", name: "Central" }, { ref: "X2", name: "Central" }];
  assert.equal(unitForCrumb(units, { ref: "KE023", name: "anything" })?.ref, "KE023");
  assert.equal(unitForCrumb(units, { ref: "KE-TUR", name: "Turkana County" })?.ref, "KE023");
  assert.equal(unitForCrumb(units, { ref: "C9", name: "Central" }), undefined);
});

test("a results map opens on the country its results sit in, even when the organisation works in several", async () => {
  const { homeCountry } = await import("../../src/features/maps/domain/drill/home-country.ts");
  const places = ["Kenya", "Nepal", "Ethiopia"].map((name) => ({ name, adminLevel: 0, archived: false }));
  const rows = (...paths: string[]) => ({ indicators: [{ rollup: { rows: paths.map((path) => ({ path })) } }] });
  assert.equal(homeCountry(places, rows("Turkana County › Kenya", "Wajir County › Kenya")), "Kenya");
  assert.equal(homeCountry(places, rows("Turkana County › Kenya", "Karnali › Nepal")), null);
  assert.equal(homeCountry(places, null), null);
  assert.equal(homeCountry([{ name: "Kenya", adminLevel: 0, archived: false }], null), "Kenya");
});
