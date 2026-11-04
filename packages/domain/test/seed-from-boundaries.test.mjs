import test from "node:test";
import assert from "node:assert/strict";
import { PlaceRegistry } from "../dist/contexts/places/place.js";
import { planBoundarySeed } from "../dist/contexts/places/seed-from-boundaries.js";

const counter = () => { let n = 0; return () => `id${++n}`; };
const units = [
  { ref: "UG3", level: 1, name: "Northern" },
  { ref: "UG3064", parentRef: "UG3", level: 2, name: "Abim", code: "UG3064" },
  { ref: "UG306601", parentRef: "UG3064", level: 3, name: "Alerek", code: "UG306601" },
  { ref: "UGX", level: 2, name: "Loose district", code: "UG9999" },
];

test("creates the country, then each level under its parent, parents first", () => {
  const plan = planBoundarySeed({ name: "Uganda" }, units, new PlaceRegistry([]), counter());
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.create.map((p) => p.name).sort(), ["Abim", "Alerek", "Loose district", "Northern", "Uganda"]);
  const byName = new Map(plan.create.map((p) => [p.name, p]));
  assert.equal(byName.get("Northern").parentId, byName.get("Uganda").id);
  assert.equal(byName.get("Abim").parentId, byName.get("Northern").id);
  assert.equal(byName.get("Alerek").parentId, byName.get("Abim").id);
  assert.equal(byName.get("Abim").code, "UG3064");
  assert.equal(byName.get("Abim").placedBy, "IMPORT");
  const levels = plan.create.map((p) => p.adminLevel);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
});

test("a unit with no known parent sits under the country and is counted", () => {
  const plan = planBoundarySeed({ name: "Uganda" }, units, new PlaceRegistry([]), counter());
  const loose = plan.create.find((p) => p.name === "Loose district");
  assert.equal(loose.parentId, plan.create.find((p) => p.name === "Uganda").id);
  assert.equal(plan.underCountry, 1);
});

test("running it again creates nothing: same code or same name under the same parent is skipped", () => {
  const first = planBoundarySeed({ name: "Uganda" }, units, new PlaceRegistry([]), counter());
  const listed = new PlaceRegistry(first.create);
  const again = planBoundarySeed({ name: "Uganda" }, units, listed, counter());
  assert.equal(again.create.length, 0);
  assert.equal(again.skipped, units.length);
});

test("an existing place with the unit's P-code stands in for it, and children attach to it", () => {
  const existing = [
    { id: "c", name: "Uganda", kind: "AREA", adminLevel: 0, aliases: [], archived: false },
    { id: "a", name: "Abim district", kind: "AREA", adminLevel: 2, parentId: "c", code: "ug3064", aliases: [], archived: false },
  ];
  const plan = planBoundarySeed({ name: "Uganda" }, units.filter((u) => u.ref !== "UG3" && u.ref !== "UGX").map((u) => (u.ref === "UG3064" ? { ...u, parentRef: undefined } : u)), new PlaceRegistry(existing), counter());
  assert.deepEqual(plan.create.map((p) => p.name), ["Alerek"]);
  assert.equal(plan.create[0].parentId, "a");
  assert.equal(plan.skipped, 1);
});

test("too many units are refused", () => {
  const many = Array.from({ length: 25_001 }, (_, i) => ({ ref: `r${i}`, level: 2, name: `P${i}` }));
  assert.equal(planBoundarySeed({ name: "X" }, many, new PlaceRegistry([]), counter()).problems.length, 1);
});
