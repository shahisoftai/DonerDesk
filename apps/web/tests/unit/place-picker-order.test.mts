import test from "node:test";
import assert from "node:assert/strict";
import { pickerMatches, parentChoices } from "../../src/features/places/domain/picker-order.ts";
import { areaRefs } from "../../src/features/places/domain/area-ticks.ts";
import { levelOf } from "../../src/features/places/domain/where-levels.ts";

const C = [
  { id: "v1", name: "Village 1", path: "Village 1 › District A1" },
  { id: "v1b", name: "Village 1", path: "Village 1 › District B1" },
  { id: "a1", name: "District A1", path: "District A1 › Province A" },
  { id: "x", name: "Xavi village", path: "Xavi village › District B1" },
];

test("the project's places come first; the rest of the organisation only when searching, labelled", () => {
  const mine = new Set(["v1", "a1"]);
  assert.deepEqual(pickerMatches("", C, mine, []).map((m) => m.id), ["a1", "v1"]);
  const hits = pickerMatches("village", C, mine, []);
  assert.deepEqual(hits.map((m) => [m.id, m.group]), [["v1", "PROJECT"], ["v1b", "ORGANISATION"], ["x", "ORGANISATION"]]);
  assert.deepEqual(pickerMatches("district b1", C, mine, []).map((m) => m.id), ["v1b", "x"], "the path tells same-named places apart");
  assert.deepEqual(pickerMatches("village", C, mine, ["v1"]).map((m) => m.id), ["v1b", "x"], "chosen places are not offered again");
});

test("a new place goes under one of the project's areas, never under a site", () => {
  const choices = [{ ...C[2], adminLevel: 2, kind: "AREA" as const }, { ...C[0], adminLevel: 4, kind: "POINT" as const }, { id: "o", name: "Other", path: "Other", adminLevel: 2, kind: "AREA" as const }];
  assert.deepEqual(parentChoices(choices, new Set(["a1", "v1"])).map((c) => c.id), ["a1"]);
});

test("a project area is matched to its boundary unit by code, else by name at the same level", () => {
  const units = new Map([[2, [{ ref: "u1", name: "Gulu", pcode: "UG01" }, { ref: "u2", name: "Lira", pcode: "UG02" }]]]) as never;
  const refs = areaRefs(units, [{ id: "p1", name: "Gulu District", adminLevel: 2, code: "UG01", archived: false }, { id: "p2", name: "Lira", adminLevel: 2, archived: false }, { id: "p3", name: "Lira", adminLevel: 1, archived: false }]);
  assert.deepEqual([...refs], [["u1", "p1"], ["u2", "p2"]]);
});

test("an unknown level falls back to provinces", () => {
  assert.equal(levelOf("2"), 2);
  assert.equal(levelOf("9"), 1);
  assert.equal(levelOf(undefined), 1);
});
