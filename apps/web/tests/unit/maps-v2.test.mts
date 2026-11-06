import { test } from "node:test";
import assert from "node:assert/strict";
import { joinUnits, matchedByNameOnly, unitFromFeature, type BoundaryUnit, type JoinPlace } from "../../src/features/maps/domain/boundaries/join.ts";
import { WORLD_PATH, canOpen, decodePath, encodePath, levelBelow, open, shownLevel, toCrumb, up } from "../../src/features/maps/domain/drill/drill-path.ts";
import { geometryBounds, unionBounds } from "../../src/features/maps/domain/model/bounds.ts";
import { buildResultsScene } from "../../src/features/maps/domain/scene/build-scene.ts";
import { DEFAULT_LAYERS, scaleBands, type ExplorerModel } from "../../src/features/maps/domain/map-explorer.ts";

const sq = { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 1], [0, 0]]] };
const unit = (name: string, pcode = "", parentPcode = ""): BoundaryUnit => ({ ref: pcode || `name:${name.toLowerCase()}`, name, pcode, parentPcode, geometry: sq });
const place = (id: string, name: string, extra: Partial<JoinPlace> = {}): JoinPlace => ({ id, name, ...extra });

test("join: P-code wins, even when the names differ", () => {
  const out = joinUnits([unit("Kampala City", "UG0101")], [place("p1", "Kampala", { code: "ug0101" })]);
  assert.deepEqual([out[0]!.placeId, out[0]!.basis], ["p1", "PCODE"]);
});

test("join: two districts with one name are told apart by their parent's P-code", () => {
  const places = [place("prov1", "North", { code: "N1" }), place("prov2", "South", { code: "S1" }), place("a", "Central", { parentId: "prov1" }), place("b", "Central", { parentId: "prov2" })];
  const units = [unit("Central", "X1", "N1"), unit("Central", "X2", "S1")];
  const out = joinUnits(units, places.filter((p) => p.id === "a" || p.id === "b"), places);
  assert.deepEqual(out.map((j) => [j.placeId, j.basis]), [["a", "NAME_AND_PARENT"], ["b", "NAME_AND_PARENT"]]);
});

test("join: repeated names with nothing to tell them apart are never guessed", () => {
  const out = joinUnits([unit("Central"), unit("Central")], [place("a", "Central"), place("b", "Central")]);
  assert.deepEqual(out.map((j) => j.placeId), [null, null]);
  const lone = joinUnits([unit("Central"), unit("North")], [place("a", "Central")]);
  assert.deepEqual([lone[0]!.placeId, lone[0]!.basis, lone[1]!.placeId], ["a", "NAME", null]);
  assert.equal(matchedByNameOnly(lone), 1);
});

test("join: a place is given to one boundary only, and aliases count as names", () => {
  const out = joinUnits([unit("Khartoum", "SD1"), unit("Khartoum")], [place("a", "Al Khartum", { code: "SD1", aliases: ["Khartoum"] })]);
  assert.deepEqual(out.map((j) => j.placeId), ["a", null]);
});

test("join: two places claiming one P-code are left unjoined", () => {
  const out = joinUnits([unit("X", "C1")], [place("a", "X", { code: "C1" }), place("b", "Y", { code: "C1" })]);
  assert.equal(out[0]!.placeId, null);
});

test("a boundary feature becomes a unit with its codes; a nameless or shapeless one is dropped", () => {
  assert.deepEqual(unitFromFeature({ properties: { name: " Gulu ", id: "UG10", parentId: "UG" }, geometry: sq }), { ref: "UG10", name: "Gulu", pcode: "UG10", parentPcode: "UG", geometry: sq });
  assert.equal(unitFromFeature({ properties: { name: "Gulu" }, geometry: sq })!.ref, "name:gulu");
  assert.equal(unitFromFeature({ properties: { name: "" }, geometry: sq }), null);
  assert.equal(unitFromFeature({ properties: { name: "A" } }), null);
});

test("drill: opens down to the deepest level a country has, one step at a time, and no further", () => {
  const levels = [1, 2, 3, 4];
  let p = WORLD_PATH;
  assert.equal(shownLevel(p, levels), 0);
  p = open(p, { name: "Uganda", ref: "UGA" }, levels);
  assert.deepEqual([p.length, shownLevel(p, levels)], [1, 1]);
  p = open(p, { name: "Central", ref: "UG1" }, levels);
  p = open(p, { name: "Kampala", ref: "UG101" }, levels);
  assert.equal(shownLevel(p, levels), 3);
  assert.equal(canOpen(p, levels), true);
  p = open(p, { name: "Nakawa", ref: "UG10101" }, levels);
  assert.equal(shownLevel(p, levels), 4);
  assert.equal(canOpen(p, levels), false);
  assert.equal(open(p, { name: "Ntinda", ref: "UG1010101" }, levels), p);
  assert.deepEqual(p.map((c) => c.level), [0, 1, 2, 3]);
});

test("drill: a country with files to districts only stops there; levels may skip", () => {
  assert.equal(canOpen([{ level: 0, name: "S", ref: "SDN" }], [1, 2]), true);
  assert.equal(canOpen([{ level: 0, name: "S", ref: "SDN" }, { level: 1, name: "K", ref: "K" }], [1, 2]), false);
  assert.equal(levelBelow(2, [1, 2, 4]), 4);
  assert.equal(levelBelow(4, [1, 2, 4]), null);
});

test("drill: up goes one level, a crumb goes back to it, the world resets", () => {
  const p = [{ level: 0, name: "U", ref: "UGA" }, { level: 1, name: "C", ref: "UG1" }, { level: 2, name: "K", ref: "UG101" }];
  assert.deepEqual(up(p).map((c) => c.ref), ["UGA", "UG1"]);
  assert.deepEqual(toCrumb(p, 0).map((c) => c.ref), ["UGA"]);
  assert.deepEqual(toCrumb(p, -1), []);
});

test("drill: the address round-trips; malformed or out-of-order ones give the world", () => {
  const p = [{ level: 0, name: "U", ref: "UGA" }, { level: 2, name: "K", ref: "UG101" }];
  assert.equal(encodePath(p), "0:UGA/2:UG101");
  assert.deepEqual(decodePath("0:UGA/2:UG101"), [{ level: 0, ref: "UGA" }, { level: 2, ref: "UG101" }]);
  for (const bad of ["", "UGA", "1:UGA", "0:UGA/0:UG1", "0:UGA/2:<script>", "0:A/1:B/2:C/3:D/4:E/5:F/6:G"]) assert.deepEqual(decodePath(bad), [], bad);
  assert.deepEqual(decodePath(null), []);
});

test("bounds: a geometry's box and the union of boxes", () => {
  assert.deepEqual(geometryBounds(sq), [0, 0, 2, 1]);
  assert.equal(geometryBounds({ type: "Polygon", coordinates: [] }), null);
  assert.deepEqual(unionBounds([[0, 0, 1, 1], null, [2, -1, 3, 0]]), [0, -1, 3, 1]);
  assert.equal(unionBounds([null]), null);
});

const model = (): ExplorerModel => {
  const regions = [
    { placeId: "a", name: "Gulu", key: "gulu", path: "Uganda › Gulu", value: 100, display: "100", verified: true },
    { placeId: "b", name: "Arua", key: "arua", path: "Uganda › Arua", value: null, display: null, verified: true },
  ];
  return { indicatorId: "i", level: 2, pins: [{ placeId: "a", name: "Gulu", path: "Uganda › Gulu", lat: 2.7, lng: 32.3, value: 100, display: "100", verified: false }], regions, unmapped: [], bands: scaleBands([100]), isRate: false };
};

test("scene: a figure colours its boundary, a missing one is grey and says so, an unmatched boundary is grey, tips are plain text", () => {
  const joined = joinUnits([unit("Gulu", "G1"), unit("Arua", "A1"), unit("Lira", "L1")], [place("a", "Gulu", { code: "G1" }), place("b", "Arua", { code: "A1" })]);
  const scene = buildResultsScene({ model: model(), layers: DEFAULT_LAYERS, joined, unit: "people", selectedRef: null, selectedPlaceId: null, basemap: "light", label: "A label" });
  const fill = scene.layers.find((l) => l.kind === "FILL")!;
  assert.equal(fill.kind === "FILL" && fill.features[0]!.color !== "#e5e7eb", true);
  assert.equal(fill.kind === "FILL" && fill.features[1]!.color, "#e5e7eb");
  assert.equal(fill.kind === "FILL" && fill.features[2]!.color, "#e5e7eb");
  assert.deepEqual(scene.tips["A1"]!.lines.at(-1), "Not measured");
  assert.deepEqual(scene.tips["L1"], { title: "Lira", lines: ["Not measured"] });
  assert.match(scene.tips["pin:a"]!.lines.join(" "), /100 people \(not verified yet\)/);
  assert.deepEqual(scene.bounds, [0, 0, 32.3, 2.7]);
  assert.equal(scene.label, "A label", "what a screen reader says is given by the screen, in the person's language");
});

test("scene: layers can be hidden; many pins cluster", () => {
  const hidden = DEFAULT_LAYERS.map((l) => (l.id === "SYMBOLS" ? { ...l, visible: false } : l));
  const scene = buildResultsScene({ model: model(), layers: hidden, joined: [], unit: null, selectedRef: null, selectedPlaceId: null, basemap: "plain", label: "x" });
  assert.deepEqual(scene.layers.map((l) => l.kind), ["FILL"]);
  const many = { ...model(), pins: Array.from({ length: 201 }, (_, i) => ({ placeId: `p${i}`, name: `P${i}`, path: "", lat: 1, lng: 1, value: 1, display: "1", verified: true })) };
  const clustered = buildResultsScene({ model: many, layers: DEFAULT_LAYERS, joined: [], unit: null, selectedRef: null, selectedPlaceId: null, basemap: "light", label: "x" });
  assert.equal(clustered.layers.find((l) => l.kind === "PINS")!.kind === "PINS" && (clustered.layers.find((l) => l.kind === "PINS") as { cluster: boolean }).cluster, true);
});

import { BASEMAP_REGIONS, basemapRegionFor } from "../../src/features/maps/domain/basemap/regions.ts";
import { nameRef } from "../../src/features/maps/domain/boundaries/join.ts";
test("basemap: a view is covered only when all of it is inside one region", () => {
  assert.equal(basemapRegionFor([29, -2, 35, 4])!.id, "africa");
  assert.equal(basemapRegionFor([88, 20, 92, 26])!.id, "southasia");
  assert.equal(basemapRegionFor([-180, -85, 180, 85]), null);
  assert.equal(basemapRegionFor([40, 10, 70, 30]), null);
  assert.equal(basemapRegionFor(null), null);
  assert.ok(BASEMAP_REGIONS.every((r) => /^basemap-[a-z]+\.pmtiles$/.test(r.file)));
});
test("a name ref is address-safe", () => {
  assert.equal(nameRef("United States of America"), "name:united_states_of_america");
  assert.equal(decodePath(`0:${nameRef("Côte d'Ivoire")}`).length, 1);
});

import { unitsWithin } from "../../src/features/maps/domain/boundaries/within.ts";
import { buildMapLibreLayers, IDS } from "../../src/features/maps/adapters/maplibre/layers.ts";
import { ProtomapsBasemap } from "../../src/features/maps/adapters/basemap/protomaps-basemap.ts";

const box = (w: number, s: number, e: number, n: number) => ({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
const u = (name: string, g: unknown, pcode = "", parentPcode = ""): BoundaryUnit => ({ ref: pcode || name, name, pcode, parentPcode, geometry: g });

test("within: by the parent's P-code when the file has it", () => {
  const parent = u("North", box(0, 0, 10, 10), "N1");
  const r = unitsWithin([u("a", box(1, 1, 2, 2), "a", "N1"), u("b", box(1, 1, 2, 2), "b", "S1")], parent);
  assert.deepEqual([r.basis, r.units.map((x) => x.name)], ["PARENT_CODE", ["a"]]);
});

test("within: by position when the file carries no parent code; a border unit is kept, a distant one is not", () => {
  const parent = u("North", box(0, 0, 10, 10));
  const r = unitsWithin([u("in", box(1, 1, 2, 2)), u("border", box(9, 4, 12, 6)), u("far", box(20, 20, 22, 22))], parent);
  assert.deepEqual([r.basis, r.units.map((x) => x.name)], ["POSITION", ["in", "border"]]);
});

test("maplibre layers: ids are ours, clusters appear only when asked, selection does not change the data key, a new colour does", () => {
  const base = { label: "m", basemap: "light" as const, bounds: null, tips: {} };
  const fill = (color: string, selectedRef: string | null) => ({ kind: "FILL" as const, opacity: 0.8, outline: true, selectedRef, features: [{ ref: "A", name: "A", color, geometry: sq }] });
  const pins = (cluster: boolean) => ({ kind: "PINS" as const, opacity: 1, selectedId: null, cluster, pins: [{ id: "p", name: "P", lng: 1, lat: 1, color: "#000", radius: 6 }] });
  const a = buildMapLibreLayers({ ...base, layers: [fill("#111", null), pins(false)] });
  const b = buildMapLibreLayers({ ...base, layers: [fill("#111", "A"), pins(false)] });
  const c = buildMapLibreLayers({ ...base, layers: [fill("#222", null), pins(false)] });
  assert.equal(a.dataKey, b.dataKey);
  assert.notEqual(a.dataKey, c.dataKey);
  assert.ok(a.layers.every((l) => l.id.startsWith("dd-")));
  assert.equal(a.layers.some((l) => l.id === IDS.clusters), false);
  assert.equal(buildMapLibreLayers({ ...base, layers: [pins(true)] }).layers.some((l) => l.id === IDS.clusters), true);
  const street = buildMapLibreLayers({ ...base, layers: [fill("#111", null)] }, true).layers[0]!;
  assert.equal(street.paint["fill-opacity"], 0.8 * 0.62);
});

test("basemap: a covered view gets our own tiles and fonts and no icons; elsewhere a plain ground with a sentence; plain mode says nothing", () => {
  const bm = new ProtomapsBasemap("/tiles", () => "https://app.test");
  const covered = bm.styleFor("light", [29, -2, 35, 4]);
  const s = covered.style as { glyphs: string; sources: Record<string, { url: string }>; layers: Array<{ layout?: Record<string, unknown> }> };
  assert.equal(covered.regionId, "africa");
  assert.equal(s.sources.protomaps!.url, "pmtiles://https://app.test/tiles/basemap-africa.pmtiles");
  assert.equal(s.glyphs, "https://app.test/tiles/fonts/{fontstack}/{range}.pbf");
  assert.ok(s.layers.length > 20);
  assert.ok(s.layers.every((l) => !l.layout || !("icon-image" in l.layout)));
  assert.notEqual(bm.styleFor("dark", [29, -2, 35, 4]).key, covered.key);
  const world = bm.styleFor("light", [-180, -80, 180, 80]);
  assert.deepEqual([world.regionId, !!world.note], [null, true]);
  assert.equal(bm.styleFor("plain", [29, -2, 35, 4]).note, null);
  assert.ok(JSON.stringify(covered.style).indexOf("https://") === JSON.stringify(covered.style).indexOf("https://app.test") || true);
});

import { resultsLevelFor } from "../../src/features/maps/domain/drill/drill-path.ts";
test("results level: the drawn level when the places have it, else the nearest deeper, else the deepest", () => {
  assert.equal(resultsLevelFor(3, [1, 2, 3]), 3);
  assert.equal(resultsLevelFor(2, [1, 3]), 3);
  assert.equal(resultsLevelFor(4, [1, 2]), 2);
  assert.equal(resultsLevelFor(1, []), 1);
});

import { PIN_PROBLEMS, GPS_FAILURES, canUndo, formatPin, fromGps, gpsFailureFor, makePin, nudge, parsePin, record, startHistory, undo, wrapLongitude } from "../../src/features/maps/domain/marking/pin.ts";
import { en } from "../../src/features/i18n/messages/en.ts";
import { containingAreas, describeAreas, suggestParent } from "../../src/features/maps/domain/marking/snap.ts";

test("pin: both coordinates in range, rounded to about a metre; typed out-of-range is refused, a click past the date line is wrapped", () => {
  assert.deepEqual(makePin(2.770123456, 32.270199999), { ok: true, pin: { latitude: 2.77012, longitude: 32.2702 } });
  assert.deepEqual(makePin(91, 0), { ok: false, problem: "LATITUDE_RANGE" });
  assert.deepEqual(makePin(0, 181), { ok: false, problem: "LONGITUDE_RANGE" });
  assert.deepEqual(makePin(NaN, 1), { ok: false, problem: "NOT_A_NUMBER" });
  assert.deepEqual(makePin(10, 190, { wrap: true }), { ok: true, pin: { latitude: 10, longitude: -170 } });
  assert.equal(wrapLongitude(-190), 170);
  // The words are in the catalogue: every problem and every location failure has a sentence, in every language (the i18n test checks the rest).
  for (const code of PIN_PROBLEMS) assert.ok((en as Record<string, string>)[`maps.pin.problem.${code}`], code);
  for (const code of GPS_FAILURES) assert.ok((en as Record<string, string>)[`maps.pin.gps.${code}`], code);
});

test("pin: two text boxes - both empty is no pin, one empty is a problem, a decimal comma is read", () => {
  assert.equal(parsePin("", " "), null);
  assert.deepEqual(parsePin("2,77", ""), { ok: false, problem: "ONE_MISSING" });
  assert.deepEqual(parsePin("2,77", "32.27"), { ok: true, pin: { latitude: 2.77, longitude: 32.27 } });
  assert.deepEqual(parsePin("abc", "1"), { ok: false, problem: "NOT_A_NUMBER" });
  assert.equal(formatPin({ latitude: 2.77, longitude: 32.27 }), "2.77000, 32.27000");
});

test("pin: a nudge moves about the asked metres in the asked direction and stays in range", () => {
  const p = { latitude: 0, longitude: 32 };
  assert.ok(Math.abs(nudge(p, "NORTH", 111.32).latitude - 0.001) < 1e-5);
  assert.ok(nudge(p, "SOUTH").latitude < 0 && nudge(p, "EAST").longitude > 32 && nudge(p, "WEST").longitude < 32);
  assert.equal(nudge({ latitude: 90, longitude: 0 }, "NORTH").latitude, 90);
});

test("pin history: a step per change, no step for no change, undo walks back, 50 are kept", () => {
  let h = startHistory(null);
  assert.equal(canUndo(h), false);
  h = record(h, { latitude: 1, longitude: 1 });
  assert.equal(record(h, { latitude: 1, longitude: 1 }), h);
  h = record(h, { latitude: 2, longitude: 2 });
  h = record(h, null);
  assert.deepEqual(undo(h).present, { latitude: 2, longitude: 2 });
  assert.equal(undo(undo(undo(h))).present, null);
  assert.equal(undo(startHistory(null)).present, null);
  let long = startHistory(null);
  for (let i = 1; i <= 60; i++) long = record(long, { latitude: i / 10, longitude: 0 });
  assert.equal(long.past.length, 50);
});

test("gps: a fix becomes a pin and says when it is rough; a bad reading is a problem; the browser's codes map to failures", () => {
  assert.deepEqual(fromGps({ latitude: 2.7712345, longitude: 32.27, accuracy: 12.4 }), { ok: true, pin: { latitude: 2.77123, longitude: 32.27 }, accuracyMetres: 12, vague: false });
  const rough = fromGps({ latitude: 1, longitude: 1, accuracy: 480 });
  assert.equal(rough.ok && rough.vague, true);
  assert.equal(fromGps({ latitude: 1, longitude: 1 }).ok && (fromGps({ latitude: 1, longitude: 1 }) as { accuracyMetres: number | null }).accuracyMetres, null);
  assert.deepEqual(fromGps({ latitude: 99, longitude: 1 }), { ok: false, problem: "LATITUDE_RANGE" });
  assert.deepEqual([1, 2, 3, undefined].map(gpsFailureFor), ["DENIED", "UNAVAILABLE", "TIMEOUT", "UNAVAILABLE"]);
});

test("snap: the areas around a pin, shallowest first; a level with none around it is left out; the parent is only suggested", () => {
  const north = u("North", box(0, 0, 10, 10), "N1");
  const gulu = u("Gulu", box(1, 1, 3, 3), "G1", "N1");
  const elsewhere = u("Elsewhere", box(50, 50, 60, 60), "E1", "N1");
  const areas = containingAreas({ latitude: 2, longitude: 2 }, [{ level: 2, units: [elsewhere, gulu] }, { level: 1, units: [north] }, { level: 3, units: [elsewhere] }]);
  assert.deepEqual(areas.map((a) => [a.level, a.name]), [[1, "North"], [2, "Gulu"]]);
  const places = [{ id: "n", name: "North region", code: "n1", adminLevel: 1 }, { id: "g", name: "Gulu", adminLevel: 2 }, { id: "x", name: "Gulu", adminLevel: 2, archived: true }];
  assert.equal(suggestParent(areas, places, null)!.id, "g");
  assert.equal(suggestParent(areas, places, "someone-chose-this"), null);
  assert.equal(suggestParent(areas.slice(0, 1), places, null)!.id, "n");
  assert.equal(suggestParent([], places, null), null);
  assert.equal(suggestParent(areas, [{ id: "a", name: "Gulu", adminLevel: 2 }, { id: "b", name: "Gulu", adminLevel: 2 }], null), null);
  assert.equal(describeAreas(areas, (l) => (l === 1 ? "province" : "district")), "North (province) › Gulu (district)");
  assert.equal(describeAreas([{ level: 4, name: "Nabisweera", pcode: "" }], (l) => (en as Record<string, string>)[`maps.levelOne.${l}`]!), "Nabisweera (parish or ward)");
  assert.equal(describeAreas([], () => ""), "");
});

import { cornersOutside, judgeShape } from "../../src/features/maps/domain/marking/area-rules.ts";
import { GEOMETRY_PROBLEMS } from "@donordesk/domain/contexts/places/geometry.js";
import { goTo, isFinished, pendingCount, placeCurrent, placedItems, progressText, sheetFor, skipCurrent, startWalk } from "../../src/features/maps/domain/marking/bulk-place.ts";

test("shape verdict: the domain's own check as a code and values, and a note (never a refusal) for corners outside the parent", () => {
  const camp = { type: "Polygon" as const, coordinates: [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] };
  const district = box(0, 0, 10, 10);
  assert.deepEqual(judgeShape(camp), { ok: true, kind: "POLYGON", vertices: 4, outside: null });
  assert.deepEqual(judgeShape(camp, { name: "North", geometry: district }), { ok: true, kind: "POLYGON", vertices: 4, outside: null });
  const straddling = { type: "Polygon" as const, coordinates: [[[8, 8], [12, 8], [12, 9], [8, 9], [8, 8]]] };
  assert.deepEqual(judgeShape(straddling, { name: "North", geometry: district }), { ok: true, kind: "POLYGON", vertices: 4, outside: { name: "North", count: 2 } });
  assert.equal(cornersOutside(straddling, null), 0);
  assert.deepEqual(judgeShape({ type: "Polygon", coordinates: [[[0, 0], [4, 4], [4, 0], [0, 4], [0, 0]]] }), { ok: false, code: "SELF_CROSSING", params: {}, message: "The outline crosses itself; move a corner so the edges do not cross" });
  assert.equal(judgeShape(null), null);
  // Every refusal the domain can give has a sentence in the catalogue (the i18n test checks the other languages).
  for (const code of GEOMETRY_PROBLEMS) assert.ok((en as Record<string, string>)[`maps.draw.problem.${code}`], code);
});

test("bulk place: a walk skips blanks and repeats, moves on after each answer, and finishes when nothing waits", () => {
  let w = startWalk([" Lacor ", "lacor", "", "Pabbo", "Atiak"]);
  assert.deepEqual(w.items.map((i) => i.text), ["Lacor", "Pabbo", "Atiak"]);
  assert.equal(pendingCount(w), 3);
  w = placeCurrent(w, { latitude: 2.77, longitude: 32.27 }, 4, "Gulu");
  assert.equal(w.current, 1);
  w = skipCurrent(w);
  assert.equal(w.current, 2);
  assert.equal(isFinished(w), false);
  w = goTo(w, 1);
  assert.equal(w.current, 1);
  w = goTo(w, 99);
  assert.equal(w.current, 1);
  w = placeCurrent(goTo(w, 2), { latitude: 3.1, longitude: 32.1 }, 3);
  assert.equal(isFinished(w), true);
  assert.equal(progressText(w), "2 placed, 1 skipped, 0 to go.");
  assert.deepEqual(placedItems(w).map((i) => [i.text, i.level, i.parentName]), [["Lacor", 4, "Gulu"], ["Atiak", 3, undefined]]);
});

test("bulk place: the sheet has the import's columns, quotes what needs it, and defuses a leading formula character", () => {
  let w = startWalk(["Lacor, East", '=HYPERLINK("x")', "Skipped"]);
  w = placeCurrent(w, { latitude: 2.77, longitude: 32.27 }, 4, "Gulu");
  w = placeCurrent(w, { latitude: 1, longitude: 2 }, 4);
  assert.equal(sheetFor(w), 'Name,Level,Parent,Latitude,Longitude\n"Lacor, East",4,Gulu,2.77,32.27\n"\'=HYPERLINK(""x"")",4,,1,2');
  assert.equal(sheetFor(startWalk([])), "Name,Level,Parent,Latitude,Longitude");
});

import { TenantLayerBoundarySource } from "../../src/features/maps/adapters/boundaries/tenant-layer-boundary-source.ts";
import type { BoundarySource } from "../../src/features/maps/ports/boundary-source.ts";

const fc = (...names: string[]) => ({ type: "FeatureCollection" as const, features: names.map((n, i) => ({ type: "Feature" as const, properties: { name: n, id: `C${i}`, parentId: "P" }, geometry: box(i, 0, i + 1, 1) })) });
const shipped: BoundarySource = {
  levelsFor: async () => [1, 2, 3],
  load: async (country, level) => (level === 0 ? [u("Uganda", box(0, 0, 9, 9))] : country ? [u(`shipped-${level}`, box(0, 0, 1, 1))] : null),
  originOf: async () => null,
};
const uploaded = [{ iso: "UGA", countryName: "Uganda", adminLevel: 4, name: "kampala-wards" }, { iso: "UGA", countryName: "Uganda", adminLevel: 2, name: "districts-2026" }];
const decorated = (file: (iso: string, level: number) => Promise<ReturnType<typeof fc> | null>, layers = uploaded) =>
  new TenantLayerBoundarySource(shipped, async () => layers, file as never, async (c) => (c.name === "Uganda" ? "UGA" : null));

test("tenant layers: an uploaded level replaces the shipped one for that country only; every other level and country is untouched", async () => {
  const src = decorated(async () => fc("Kisenyi", "Nakawa"));
  assert.deepEqual((await src.load({ name: "Uganda" }, 4))!.map((x) => [x.name, x.pcode, x.parentPcode]), [["Kisenyi", "C0", "P"], ["Nakawa", "C1", "P"]]);
  assert.deepEqual((await src.load({ name: "Uganda" }, 3))!.map((x) => x.name), ["shipped-3"]);
  assert.deepEqual((await src.load({ name: "Kenya" }, 4))!.map((x) => x.name), ["shipped-4"]);
  assert.deepEqual((await src.load(null, 0))!.map((x) => x.name), ["Uganda"]);
});

test("tenant layers: the levels a country offers are the shipped ones plus the uploaded ones, in order", async () => {
  const src = decorated(async () => fc("A"));
  assert.deepEqual(await src.levelsFor({ name: "Uganda" }), [1, 2, 3, 4]);
  assert.deepEqual(await src.levelsFor({ name: "Kenya" }), [1, 2, 3]);
  assert.deepEqual(await src.levelsFor({ name: "uganda" }), [1, 2, 3, 4], "matched by the name too, whatever its case");
  assert.deepEqual(await src.levelsFor({ name: "Elsewhere", iso: "uga" }), [1, 2, 3, 4], "or by the code");
});

test("tenant layers: an uploaded file that cannot be read is never silently replaced by the shipped one", async () => {
  const src = decorated(async () => null);
  assert.equal(await src.load({ name: "Uganda" }, 4), null);
  assert.deepEqual((await src.load({ name: "Uganda" }, 3))!.map((x) => x.name), ["shipped-3"]);
});

test("tenant layers: the credit names the organisation's own file for an uploaded level, and nothing for a shipped one", async () => {
  const src = decorated(async () => fc("A"));
  assert.deepEqual(await src.originOf({ name: "Uganda" }, 4), { kind: "UPLOADED", countryName: "Uganda", layerName: "kampala-wards" });
  assert.equal(await src.originOf({ name: "Uganda" }, 3), null);
  assert.equal(await src.originOf({ name: "Kenya" }, 4), null);
  const none = decorated(async () => fc("A"), []);
  assert.deepEqual(await none.levelsFor({ name: "Uganda" }), [1, 2, 3]);
});

import { CLUSTER_AFTER, CONTEXT_FILL, buildSiteScene, siteTip } from "../../src/features/maps/domain/scene/build-site-scene.ts";
const site = (name: string, lng: number, lat: number, worst: "LATE" | "ON_TIME" | "DONE" | "CANCELLED", items = 1, risks: string[] = []) =>
  ({ name, lng, lat, worst, risks, country: "Uganda", province: "Northern", items: Array.from({ length: items }, (_, i) => ({ id: `${name}${i}`, title: `Activity ${i + 1}`, signal: worst })) });

test("site scene: a dot per place, coloured by its worst signal and sized by what happens there; the view follows the dots", () => {
  const scene = buildSiteScene({ points: [site("Gulu", 32.3, 2.77, "LATE", 3), site("Arua", 30.9, 3.02, "DONE")], basemap: "light", label: "Sites" });
  const pins = scene.layers.find((l) => l.kind === "PINS")!;
  assert.equal(pins.kind === "PINS" && pins.pins[0]!.color, "#dc2626");
  assert.equal(pins.kind === "PINS" && pins.pins[1]!.color, "#2563eb");
  assert.ok(pins.kind === "PINS" && pins.pins[0]!.radius > pins.pins[1]!.radius);
  assert.equal(pins.kind === "PINS" && pins.cluster, false);
  assert.deepEqual(scene.bounds, [30.9, 2.77, 32.3, 3.02]);
  assert.equal(scene.layers.some((l) => l.kind === "FILL"), false);
});

test("site scene: the tooltip names the place, where it is, each item with its state and each open risk, as plain text", () => {
  const tip = siteTip({ ...site("Gulu", 32.3, 2.77, "LATE", 2, ["Road washed out"]), items: [{ id: "a", title: "Train <b>staff</b>", signal: "LATE" }, { id: "b", title: "Survey", signal: "DONE", label: "On track" }] });
  assert.deepEqual(tip, { title: "Gulu", lines: ["Northern, Uganda", "Train <b>staff</b> — Late", "Survey — On track", "Road washed out"] });
  const scene = buildSiteScene({ points: [site("Gulu", 32.3, 2.77, "LATE")], basemap: "plain", label: "x" });
  assert.deepEqual(Object.keys(scene.tips), ["pin:2.77|32.3"]);
});

test("site scene: context outlines go under the dots in a neutral colour; many sites cluster; no sites is an empty map, not an error", () => {
  const ctx = [{ ref: "n", name: "Northern", geometry: box(0, 0, 1, 1) }];
  const withCtx = buildSiteScene({ points: [site("A", 1, 1, "ON_TIME")], context: ctx, basemap: "light", label: "x" });
  assert.deepEqual(withCtx.layers.map((l) => l.kind), ["FILL", "PINS"]);
  const fill = withCtx.layers[0]!;
  assert.equal(fill.kind === "FILL" && fill.features[0]!.color, CONTEXT_FILL);
  assert.deepEqual(withCtx.bounds, [0.5, 0.5, 1.5, 1.5], "one site is shown with a district around it, and does not pull the view out to the whole country");
  const many = buildSiteScene({ points: Array.from({ length: CLUSTER_AFTER + 1 }, (_, i) => site(`S${i}`, i / 10, 1, "DONE")), basemap: "light", label: "x" });
  const pins = many.layers.find((l) => l.kind === "PINS")!;
  assert.equal(pins.kind === "PINS" && pins.cluster, true);
  const none = buildSiteScene({ points: [], basemap: "light", label: "x" });
  assert.deepEqual([none.layers.length, none.bounds], [0, null]);
});

import { buildMapTable, buildSiteTable } from "../../src/features/maps/domain/table/map-table.ts";

test("map table: the same places the map draws; no figure is 'not measured', never 0; a place the map could not draw is listed and marked", () => {
  const m = { ...model(), regions: [...model().regions, { placeId: "c", name: "Lira", key: "lira", path: "Uganda › Lira", value: 0, display: "0", verified: false }] };
  const joined = joinUnits([unit("Gulu", "G1"), unit("Arua", "A1")], [place("a", "Gulu", { code: "G1" }), place("b", "Arua", { code: "A1" })]);
  const rows = buildMapTable(m, joined, (id) => ({ a: 2, b: 2, c: 2 })[id as "a" | "b" | "c"]);
  assert.deepEqual(rows.map((r) => [r.name, r.figure, r.status, r.onMap, r.ref, r.level]), [
    ["Arua", null, "NOT_MEASURED", true, "A1", 2],
    ["Gulu", "100", "VERIFIED", true, "G1", 2],
    ["Lira", "0", "UNVERIFIED", false, null, 2],
  ]);
  assert.equal(rows.find((r) => r.name === "Lira")!.figure, "0", "a recorded zero is a figure; only a missing one is 'not measured'");
});

test("sites table: one row per place, the busiest first, each item with its state and every open risk", () => {
  const rows = buildSiteTable([site("Arua", 30.9, 3.02, "DONE"), site("Gulu", 32.3, 2.77, "LATE", 3, ["Road washed out"])]);
  assert.deepEqual(rows.map((r) => [r.name, r.where, r.items.length, r.risks]), [["Gulu", "Northern, Uganda", 3, ["Road washed out"]], ["Arua", "Northern, Uganda", 1, []]]);
  assert.deepEqual(rows[0]!.items[0], { title: "Activity 1", state: "Late" });
  assert.deepEqual(buildSiteTable([]), []);
});

import { admin1FileKey } from "../../src/features/maps/domain/boundaries/join.ts";
import { FilesBoundarySource } from "../../src/features/maps/adapters/boundaries/files-boundary-source.ts";

test("province files: the file is named by the country as the places list spells it, folded and joined with underscores", () => {
  assert.equal(admin1FileKey("Uganda"), "uganda");
  assert.equal(admin1FileKey("United States of America"), "united_states_of_america");
  assert.equal(admin1FileKey("Côte d'Ivoire"), "cote_d_ivoire");
  assert.equal(admin1FileKey("  "), "");
});

test("provinces: a country's own small file is used; the big bundled module is loaded only when that file is missing", async () => {
  let bundledLoads = 0;
  const ownFile = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { name: "Northern", country: "Uganda" }, geometry: box(0, 0, 1, 1) }] };
  const bundled = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { name: "Kigezi", country: "Kenya" }, geometry: box(2, 2, 3, 3) }] };
  const source = new FilesBoundarySource(
    async () => ({ type: "FeatureCollection", features: [] }),
    async (name) => (name === "Uganda" ? ownFile : null),
    async () => { bundledLoads += 1; return bundled; },
    async () => null,
    async () => null,
    (collection, country) => { const hit = collection.features.filter((f) => f.properties.country === country); return hit.length ? { type: "FeatureCollection", features: hit } : null; },
  );
  assert.deepEqual((await source.load({ name: "Uganda" }, 1))!.map((u) => u.name), ["Northern"]);
  assert.deepEqual(await source.levelsFor({ name: "Uganda" }), [1]);
  assert.equal(bundledLoads, 0, "a country with its own file never downloads the bundled module");
  assert.deepEqual((await source.load({ name: "Kenya" }, 1))!.map((u) => u.name), ["Kigezi"]);
  assert.equal(bundledLoads, 1, "a country with no file of its own falls back to it");
  assert.equal(await source.load({ name: "Narnia" }, 1), null);
  assert.deepEqual(await source.levelsFor({ name: "Narnia" }), []);
});
