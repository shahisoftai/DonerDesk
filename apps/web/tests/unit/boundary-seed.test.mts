import test from "node:test";
import assert from "node:assert/strict";
import { seedUnitsFrom } from "../../src/features/places/domain/boundary-seed.ts";

const square = (x: number, y: number, s = 1) => ({ type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const unit = (name: string, geometry: unknown, pcode = "", parentPcode = "") => ({ ref: pcode || `name:${name}`, name, pcode, parentPcode, geometry });

test("a unit takes the parent its P-code names", () => {
  const { units: out } = seedUnitsFrom({
    2: [unit("Abim", square(0, 0), "UG3064")],
    3: [unit("Alerek", square(0.2, 0.2, 0.1), "UG306601", "UG3064")],
  });
  const abim = out.find((u) => u.name === "Abim")!;
  const alerek = out.find((u) => u.name === "Alerek")!;
  assert.equal(abim.parentRef, undefined);
  assert.equal(alerek.parentRef, abim.ref);
  assert.equal(alerek.code, "UG306601");
});

test("without codes, the one outline that holds the unit is its parent", () => {
  const { units: out } = seedUnitsFrom({
    1: [unit("North", square(0, 0, 10)), unit("South", square(20, 0, 10))],
    2: [unit("Gulu", square(1, 1, 1)), unit("Kisumu", square(22, 1, 1))],
  });
  const ref = (n: string) => out.find((u) => u.name === n)!;
  assert.equal(ref("Gulu").parentRef, ref("North").ref);
  assert.equal(ref("Kisumu").parentRef, ref("South").ref);
});

test("a unit that no outline holds, or two outlines hold, gets no parent", () => {
  const { units: out } = seedUnitsFrom({
    1: [unit("A", square(0, 0, 10)), unit("B", square(5, 0, 10))],
    2: [unit("Overlap", square(6, 1, 1)), unit("Outside", square(50, 50, 1))],
  });
  assert.equal(out.find((u) => u.name === "Overlap")!.parentRef, undefined);
  assert.equal(out.find((u) => u.name === "Outside")!.parentRef, undefined);
});

test("skipping a level links to the nearest chosen coarser level; refs stay unique", () => {
  const { units: out } = seedUnitsFrom({
    1: [unit("North", square(0, 0, 10))],
    3: [unit("Ward", square(1, 1, 1), "W1"), unit("Ward", square(3, 3, 1), "W2")],
  });
  const north = out.find((u) => u.name === "North")!;
  assert.deepEqual(out.filter((u) => u.name === "Ward").map((u) => u.parentRef), [north.ref, north.ref]);
  assert.equal(new Set(out.map((u) => u.ref)).size, out.length);
});

test("provinces that the finer file never names are left out and reported, not guessed into", () => {
  const { units, dropped } = seedUnitsFrom({
    1: [unit("Abim", square(0, 0, 10))],
    2: [unit("Abim district", square(1, 1, 1), "UG3064", "UG3"), unit("Agago", square(3, 3, 1), "UG3066", "UG3")],
  });
  assert.deepEqual(dropped, [1]);
  assert.deepEqual(units.map((u) => u.name).sort(), ["Abim district", "Agago"]);
  assert.ok(units.every((u) => u.parentRef === undefined));
});
