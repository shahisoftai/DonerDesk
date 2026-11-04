import test from "node:test";
import assert from "node:assert/strict";
import { checkPlanPlaces, planPlaceSummary, PLAN_PLACES_MAX } from "../dist/contexts/workplan/plan-places.js";

const known = [
  { id: "a", name: "Gulu", archived: false },
  { id: "b", name: "Kitgum", archived: false },
  { id: "old", name: "Old camp", archived: true },
];

test("keeps the order chosen and drops repeats", () => {
  const r = checkPlanPlaces(["b", "a", "b"], known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, ["b", "a"]);
});

test("an empty list is allowed (it clears the places)", () => {
  assert.deepEqual(checkPlanPlaces([], known).value, []);
});

test("a place outside the list is refused", () => {
  const r = checkPlanPlaces(["a", "zzz"], known);
  assert.equal(r.ok, false);
  assert.match(r.error.message, /places list/);
});

test("a retired place is refused and named", () => {
  const r = checkPlanPlaces(["old"], known);
  assert.equal(r.ok, false);
  assert.match(r.error.message, /Old camp/);
});

test("more than the limit is refused", () => {
  const many = Array.from({ length: PLAN_PLACES_MAX + 1 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, archived: false }));
  assert.equal(checkPlanPlaces(many.map((p) => p.id), many).ok, false);
  assert.equal(checkPlanPlaces(many.slice(0, PLAN_PLACES_MAX).map((p) => p.id), many).ok, true);
});

test("summary reads as one line", () => {
  assert.equal(planPlaceSummary([]), "");
  assert.equal(planPlaceSummary(["Gulu"]), "Gulu");
  assert.equal(planPlaceSummary(["Gulu", "Kitgum"]), "Gulu and Kitgum");
  assert.equal(planPlaceSummary(["Gulu", "Kitgum", "Lira", "Arua"]), "Gulu, Kitgum and 2 more");
});
