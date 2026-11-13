import assert from "node:assert/strict";
import test from "node:test";
import { canRecordByPlace, defaultPlaceLevel, placeEntries, placeRows, suggestPlaceRecording, totalFromPlaces, mapReadiness, MAP_READINESS_CODES } from "../dist/index.js";

const p = (id, name, adminLevel, archived = false) => ({ id, name, adminLevel, archived });
const places = [p("c", "Kenya", 0), p("a", "Nakuru", 1), p("b", "Kisumu", 1), p("d", "Gone", 1, true), p("e", "Town", 2)];

test("the level most places are at, shallower on a tie; none without places", () => {
  assert.equal(defaultPlaceLevel(places), 1);
  assert.equal(defaultPlaceLevel([p("c", "Kenya", 0)]), null);
  assert.equal(defaultPlaceLevel([p("a", "A", 1), p("b", "B", 2)]), 1);
});

test("rows are the live places of the level, in name order", () => {
  assert.deepEqual(placeRows(places, 1).map((r) => r.name), ["Kisumu", "Nakuru"]);
});

test("a calculated indicator is never recorded by place; no places is refused; a chosen level wins", () => {
  assert.deepEqual(canRecordByPlace({ calculated: true }, places), { ok: false, reason: "CALCULATED" });
  assert.deepEqual(canRecordByPlace({ calculated: false }, []), { ok: false, reason: "NO_PLACES" });
  assert.deepEqual(canRecordByPlace({ calculated: false }, places), { ok: true, level: 1 });
  assert.deepEqual(canRecordByPlace({ calculated: false, placeLevel: 2 }, places), { ok: true, level: 2 });
  assert.deepEqual(canRecordByPlace({ calculated: false, placeLevel: 3 }, places), { ok: false, reason: "NO_PLACES" });
});

test("only additive, typed, not-yet-by-place indicators are suggested", () => {
  const out = suggestPlaceRecording([
    { id: "n", type: "NUMBER", calculated: false, recordByPlace: false },
    { id: "r", type: "PERCENTAGE", calculated: false, recordByPlace: false },
    { id: "d", type: "NUMBER", calculated: false, recordByPlace: true },
    { id: "f", type: "NUMBER", calculated: true, recordByPlace: false },
  ], places);
  assert.deepEqual(out, [{ indicatorId: "n", level: 1 }]);
  assert.deepEqual(suggestPlaceRecording([{ id: "n", type: "NUMBER", calculated: false, recordByPlace: false }], []), []);
});

test("the total sums typed figures, is empty with none and is never made for a rate", () => {
  assert.equal(totalFromPlaces("NUMBER", [{ value: "1,200" }, { value: "300" }, { value: "" }]), "1500");
  assert.equal(totalFromPlaces("NUMBER", [{ value: "" }]), null);
  assert.equal(totalFromPlaces("PERCENTAGE", [{ value: "40" }, { value: "60" }]), null);
  assert.deepEqual(placeEntries([{ name: "Nakuru", value: " 5 " }, { name: "Kisumu", value: "" }]), [{ dimension: "LOCATION", category: "Nakuru", value: "5" }]);
});

test("the map says the first thing missing", () => {
  const ind = (o) => ({ id: "i", code: "1.1", name: "n", recordByPlace: false, hasFigureByPlace: false, ...o });
  assert.equal(mapReadiness({ placeCount: 0, indicators: [], unconfirmedLocations: 0 }).code, "NO_PLACES");
  assert.equal(mapReadiness({ placeCount: 3, indicators: [ind({})], unconfirmedLocations: 2 }).code, "NO_INDICATOR_BY_PLACE");
  assert.equal(mapReadiness({ placeCount: 3, indicators: [ind({ recordByPlace: true })], unconfirmedLocations: 0 }).code, "NO_VALUES_YET");
  assert.equal(mapReadiness({ placeCount: 3, indicators: [ind({ recordByPlace: true, hasFigureByPlace: true })], unconfirmedLocations: 2 }).code, "PLACES_TO_CONFIRM");
  assert.equal(mapReadiness({ placeCount: 3, indicators: [ind({ recordByPlace: true, hasFigureByPlace: true })], unconfirmedLocations: 0 }), null);
  assert.equal(MAP_READINESS_CODES.length, 4);
});
