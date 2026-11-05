// Phase 43: what a tick means on the Places slide.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_SELECTION, childrenOf, countsByLevel, entryFor, matchDocumentPlaces, refOf, searchAreas, selectionFromPlaces, someRefs, tickState, toPicks, toggle,
} from "../../src/features/project-setup/pcw/domain/place-picker.ts";
import type { BoundaryUnit } from "../../src/features/maps/domain/boundaries/join.ts";

const square = (x: number, y: number, s = 1) => ({ type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const unit = (ref: string, name: string, x: number, y: number, s: number, pcode = "", parentPcode = ""): BoundaryUnit => ({ ref, name, pcode, parentPcode, geometry: square(x, y, s) });

// North (no P-code, like the bundled provinces) holds Gulu and Abim; South holds Kampala.
const north = unit("name:north", "North", 0, 0, 10);
const south = unit("name:south", "South", 0, 20, 10);
const gulu = unit("UG1", "Gulu", 1, 1, 1, "UG1", "UGX");
const abim = unit("UG2", "Abim", 4, 4, 1, "UG2", "UGX");
const kampala = unit("UG3", "Kampala", 1, 21, 1, "UG3", "UGX");
const levels = new Map<number, readonly BoundaryUnit[]>([[1, [north, south]], [2, [gulu, abim, kampala]]]);

test("an area is found inside its parent by position when the parent has no code", () => {
  assert.deepEqual(childrenOf(levels.get(2)!, north).map((u) => u.name), ["Abim", "Gulu"]);
  assert.deepEqual(childrenOf(levels.get(2)!, south).map((u) => u.name), ["Kampala"]);
});

test("a tick covers what is inside it, and the larger area replaces ticks inside it", () => {
  const e = entryFor(gulu, 2, levels);
  assert.deepEqual(e.chain.map((c) => c.name), ["North"]);
  let sel = toggle(EMPTY_SELECTION, e.node, e.chain);
  assert.equal(tickState(sel, someRefs(sel), e.chain[0]!, []), "SOME");
  sel = toggle(sel, e.chain[0]!, []);
  assert.deepEqual([...sel.keys()], ["name:north"], "ticking North drops the tick on Gulu");
  assert.equal(tickState(sel, someRefs(sel), e.node, [e.chain[0]!]), "INSIDE");
  assert.equal(toggle(sel, e.node, e.chain), sel, "an area inside a ticked one is not ticked alone");
  assert.equal(toggle(sel, e.chain[0]!, []).size, 0, "unticking the larger one clears it");
});

test("the draft stores every ticked area and, above each, the areas it sits in as parents only", () => {
  const g = entryFor(gulu, 2, levels);
  const s = entryFor(south, 1, levels);
  const sel = toggle(toggle(EMPTY_SELECTION, g.node, g.chain), s.node, s.chain);
  const picks = toPicks(sel);
  assert.deepEqual(picks.map((p) => [p.name, p.adminLevel, p.parentRef, p.viaChildren]).sort(), [
    ["Gulu", 2, "name:north", false], ["North", 1, null, true], ["South", 1, null, false],
  ]);
  assert.equal(picks.find((p) => p.name === "North")!.code, null, "an area without a P-code sends none");
  assert.equal(picks.find((p) => p.name === "Gulu")!.code, "UG1");
  assert.deepEqual(countsByLevel(sel), { 1: 1, 2: 1 });
});

test("the ticks come back from the places a draft holds", () => {
  const g = entryFor(gulu, 2, levels);
  const places = toPicks(toggle(EMPTY_SELECTION, g.node, g.chain)).map((p) => ({
    name: p.name, adminLevel: p.adminLevel, parentName: p.parentRef === "name:north" ? "North" : null, latitude: null, longitude: null, code: p.code ?? null, mapRef: p.ref, viaChildren: p.viaChildren,
  }));
  const back = selectionFromPlaces(places as never);
  assert.deepEqual([...back.keys()], ["UG1"]);
  assert.deepEqual(back.get("UG1")!.chain.map((c) => c.name), ["North"]);
});

test("search finds areas at any level by part of the name", () => {
  assert.deepEqual(searchAreas(levels, "gul").map((f) => [f.unit.name, f.level]), [["Gulu", 2]]);
  assert.deepEqual(searchAreas(levels, "g"), [], "one letter finds nothing");
});

test("a document place is matched by name (and level) and never guessed when two areas share it", () => {
  const dup = new Map(levels);
  dup.set(3, [unit("p1", "Gulu", 1, 1, 0.2)]);
  const place = (name: string, adminLevel: number | null) => ({ name, adminLevel, parentName: null, latitude: null, longitude: null }) as never;
  const r = matchDocumentPlaces([{ index: 0, place: place("Abim District", 2) }, { index: 1, place: place("abim", 2) }, { index: 2, place: place("Gulu", null) }, { index: 3, place: place("Gulu", 2) }], dup);
  assert.deepEqual(r.matched.map((m) => [m.index, m.found.unit.name]), [[0, "Abim"], [1, "Abim"], [3, "Gulu"]], "'Abim District' is Abim: the shared name rule drops the suffix");
  assert.deepEqual(r.unmatched, [2], "a bare 'Gulu' is two areas, so it is not guessed");
});

test("refOf keeps the file's own code only when it has one", () => {
  assert.equal(refOf(north, 1, null).code, null);
  assert.equal(refOf(gulu, 2, null).code, "UG1");
});

import { focusUnits, visibleRows } from "../../src/features/project-setup/pcw/domain/place-picker.ts";
import { pickerScene } from "../../src/features/project-setup/pcw/domain/place-picker-scene.ts";

test("the tree opens one level at a time and the map shows what is inside the open area", () => {
  const closed = visibleRows([1, 2], levels, new Set());
  assert.deepEqual(closed.map((r) => [r.node.name, r.depth, r.canOpen]), [["North", 0, true], ["South", 0, true]]);
  const open = visibleRows([1, 2], levels, new Set(["name:north"]));
  assert.deepEqual(open.map((r) => [r.node.name, r.depth]), [["North", 0], ["Abim", 1], ["Gulu", 1], ["South", 0]]);
  assert.deepEqual(open[1]!.ancestors.map((a) => a.name), ["North"]);
  assert.equal(open[1]!.canOpen, false, "the finest level has nothing under it");
  assert.deepEqual(focusUnits([1, 2], levels, null)!.list.map((u) => u.name).sort(), ["North", "South"]);
  assert.deepEqual(focusUnits([1, 2], levels, open[0]!)!.list.map((u) => u.name).sort(), ["Abim", "Gulu"]);
  assert.equal(focusUnits([1, 2], levels, open[1]!), null, "nothing under the finest level");
  assert.equal(focusUnits([1, 2], new Map([[1, levels.get(1)!]]), open[0]!), null, "null until the next level has loaded");
});

test("the map's scene shades ticked areas and names the state in words", () => {
  const words = { ON: "Ticked", INSIDE: "Inside a ticked area", SOME: "Some inside are ticked", OFF: "" };
  const scene = pickerScene({ label: "x", units: [gulu, abim], stateOf: (u) => (u.name === "Gulu" ? "ON" : "OFF"), stateWords: words, activeRef: "UG2", dark: false });
  const fill = scene.layers[0] as { features: Array<{ ref: string; color: string }>; selectedRef: string };
  assert.notEqual(fill.features[0]!.color, fill.features[1]!.color);
  assert.deepEqual(scene.tips.UG1!.lines, ["Ticked"]);
  assert.deepEqual(scene.tips.UG2!.lines, []);
  assert.equal(fill.selectedRef, "UG2");
  assert.ok(scene.bounds);
});

test("a name that exists at two levels is matched by the place the document says it is inside", () => {
  const twin = unit("p9", "Gulu", 1.2, 1.2, 0.2); // a smaller area of the same name, inside the district Gulu, itself inside North
  const lv = new Map<number, readonly BoundaryUnit[]>([[1, [north, south]], [2, [gulu, abim, kampala]], [3, [twin]]]);
  const place = (name: string, parentName: string | null) => ({ name, adminLevel: null, parentName, latitude: null, longitude: null }) as never;
  const none = matchDocumentPlaces([{ index: 0, place: place("Gulu", null) }], lv);
  assert.deepEqual(none.unmatched, [0], "without a parent two areas share the name, so it is not guessed");
  const inNorth = matchDocumentPlaces([{ index: 0, place: place("Gulu", "North") }], lv);
  assert.deepEqual(inNorth.matched.map((m) => [m.found.level, m.found.unit.ref]), [[2, "UG1"]], "the wider one is chosen: it holds the smaller, so it is never wrong");
  const elsewhere = matchDocumentPlaces([{ index: 0, place: place("Gulu", "South") }], lv);
  assert.deepEqual(elsewhere.unmatched, [0], "neither Gulu is inside South");
});
