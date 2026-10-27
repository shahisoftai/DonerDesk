import test from "node:test";
import assert from "node:assert/strict";
import { PlaceRegistry, resolvePlace, validatePlace, parsePlaceSheet, planPlaceImport, parseAdminLevel } from "../dist/index.js";

const P = (id, name, adminLevel, parentId, over = {}) => ({ id, name, kind: "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false, ...over });
const PLACES = [
  P("sd", "Sudan", 0, undefined, { country: "SD" }),
  P("wn", "White Nile", 1, "sd"),
  P("kas", "Kassala", 1, "sd"),
  P("rabak", "Rabak", 2, "wn", { aliases: ["Rabak locality"] }),
  P("sinja", "Sinja", 2, "kas"),
  P("gulu-ug", "Gulu", 2, undefined, { country: "UG" }),
  P("gulu-ss", "Gulu", 2, undefined, { country: "SS" }),
];
const reg = new PlaceRegistry(PLACES);

test("a typed name, with a suffix or in other case, finds its place", () => {
  assert.equal(resolvePlace("rabak", reg).place.id, "rabak");
  assert.equal(resolvePlace("Rabak Locality", reg).place.id, "rabak");
});

test("two places with one name are ambiguous until context tells them apart; never picked", () => {
  const r = resolvePlace("Gulu", reg);
  assert.equal(r.status, "AMBIGUOUS");
  assert.equal(r.candidates.length, 2);
  assert.equal(resolvePlace("Gulu", reg, { country: "UG" }).place.id, "gulu-ug");
});

test("a trailing parent narrows the match", () => {
  const dup = new PlaceRegistry([...PLACES, P("rabak2", "Rabak", 2, "kas")]);
  assert.equal(resolvePlace("Rabak", dup).status, "AMBIGUOUS");
  assert.equal(resolvePlace("Rabak, White Nile", dup).place.id, "rabak");
  assert.equal(resolvePlace("Rabak, Kassala", dup).place.id, "rabak2");
});

test("unknown or blank text is unresolved, never guessed", () => {
  assert.equal(resolvePlace("Atlantis", reg).status, "UNRESOLVED");
  assert.equal(resolvePlace("  ", reg).status, "UNRESOLVED");
});

test("archived places are not offered", () => {
  const r = new PlaceRegistry([...PLACES, P("old", "Oldtown", 2, "wn", { archived: true })]);
  assert.equal(resolvePlace("Oldtown", r).status, "UNRESOLVED");
});

test("roll-up: the place at a level containing a place; nothing invented", () => {
  assert.equal(reg.ancestorAtLevel("rabak", 1).id, "wn");
  assert.equal(reg.ancestorAtLevel("rabak", 0).id, "sd");
  assert.equal(reg.ancestorAtLevel("rabak", 2).id, "rabak");
  assert.equal(reg.ancestorAtLevel("gulu-ug", 1), undefined);
  assert.equal(reg.pathLabel("rabak"), "Rabak › White Nile › Sudan");
  assert.deepEqual([...reg.descendantIds("sd")].sort(), ["kas", "rabak", "sinja", "wn"]);
});

test("validation: parent below, no cycles, pin pairs, areas have no pin, no duplicate under one parent", () => {
  assert.ok(validatePlace(P("new", "Kosti", 2, "wn"), PLACES).ok);
  assert.match(validatePlace(P("new", "Kosti", 1, "wn"), PLACES).error.message, /must sit below/);
  assert.match(validatePlace(P("sd", "Sudan", 0, "rabak"), PLACES).error.message, /below|inside/);
  assert.match(validatePlace(P("n", "X", 2, "wn", { latitude: 1 }), PLACES).error.message, /both latitude and longitude/);
  assert.match(validatePlace(P("n", "X", 2, "wn", { latitude: 1, longitude: 2 }), PLACES).error.message, /area has no pin/);
  assert.match(validatePlace(P("n", "X", 4, "wn", { kind: "POINT", latitude: 99, longitude: 2 }), PLACES).error.message, /outside the map/);
  assert.match(validatePlace(P("n", "rabak", 2, "wn"), PLACES).error.message, /already listed/);
  assert.ok(validatePlace(P("n", "Rabak", 2, "kas"), PLACES).ok);
  assert.match(validatePlace(P("n", "", 2, "wn"), PLACES).error.message, /needs a name/);
});

test("level words are understood", () => {
  assert.equal(parseAdminLevel("State"), 1);
  assert.equal(parseAdminLevel("Locality"), 2);
  assert.equal(parseAdminLevel("camp"), 4);
  assert.equal(parseAdminLevel("galaxy"), undefined);
});

const SHEET = `Name,Level,Parent,Latitude,Longitude,Code,Other spellings
Ed Damazin,District,Blue Nile,,,SD-BN-01,Ad Damazin|Damazin
Blue Nile,State,Sudan,,,,
Um Gargur IDP site,Site,Rabak,13.2,32.7,,
Rabak,District,White Nile,,,,`;

test("import: parents are created before children whatever the row order; names resolve to sheet or list", () => {
  const parsed = parsePlaceSheet(SHEET);
  assert.deepEqual(parsed.problems, []);
  let n = 0;
  const plan = planPlaceImport(parsed.rows, reg, () => `n${++n}`);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.skipped.map((s) => s.name), ["Rabak"]);
  const names = plan.create.map((p) => p.name);
  assert.ok(names.indexOf("Blue Nile") < names.indexOf("Ed Damazin"));
  const site = plan.create.find((p) => p.name === "Um Gargur IDP site");
  assert.equal(site.parentId, "rabak");
  assert.equal(site.kind, "POINT");
  assert.deepEqual(plan.create.find((p) => p.name === "Ed Damazin").aliases, ["Ad Damazin", "Damazin"]);
});

test("import: one bad row blocks all and names its row", () => {
  const parsed = parsePlaceSheet("Name,Level,Parent\nA,District,Nowhere\nB,Galaxy,\n");
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].row, 3);
  const plan = planPlaceImport(parsePlaceSheet("Name,Level,Parent\nA,District,Nowhere\n").rows, reg, () => "x");
  assert.equal(plan.create.length, 0);
  assert.equal(plan.problems[0].row, 2);
  assert.match(plan.problems[0].message, /not in the sheet or in your places/);
});

test("import: missing columns and cycles are refused plainly", () => {
  assert.match(parsePlaceSheet("Foo,Bar\n1,2").problems[0].message, /Name/);
  const cyc = planPlaceImport(parsePlaceSheet("Name,Level,Parent\nA,District,B\nB,District,A\n").rows, new PlaceRegistry([]), () => Math.random().toString());
  assert.ok(cyc.problems.length >= 1);
  assert.equal(cyc.create.length, 0);
});
