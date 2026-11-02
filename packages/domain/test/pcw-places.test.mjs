import test from "node:test";
import assert from "node:assert/strict";
import { PLACE_OPERATIONS, applyPlaceOperation, emptyProposal, emptyDraft, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox } from "../dist/index.js";

const run = (p, op) => { const r = applyPlaceOperation(p, op); assert.equal(r.ok, true, r.reason); return r.proposal; };
const refused = (p, op) => { const r = applyPlaceOperation(p, op); assert.equal(r.ok, false); return r.reason; };
const names = (p) => p.places.map((x) => x.value.name);

function base() {
  let p = emptyProposal();
  p = run(p, { kind: "ADD_PLACE", name: "Uganda", adminLevel: 0 });
  p = run(p, { kind: "ADD_PLACE", name: "Gulu District", adminLevel: 2, parentName: "Uganda" });
  return p;
}

test("every place operation kind has a handler", () => {
  assert.deepEqual(Object.keys(PLACE_OPERATIONS).sort(), ["ADD_PLACE", "EDIT_PLACE"]);
});

test("a typed place is the person's own and needs no quote", () => {
  const p = base();
  assert.ok(p.places.every((x) => x.status === "EDITED" && x.sourceQuote === null));
  assert.deepEqual(p.places[1].value, { name: "Gulu District", adminLevel: 2, parentName: "Uganda", latitude: null, longitude: null });
});

test("a place needs a name and a real kind", () => {
  const p = emptyProposal();
  assert.match(refused(p, { kind: "ADD_PLACE", name: "  " }), /name/);
  assert.match(refused(p, { kind: "ADD_PLACE", name: "X", adminLevel: 9 }), /kind of place/);
  assert.equal(applyPlaceOperation(p, { kind: "ADD_PLACE", name: "Somewhere" }).ok, true, "the kind may be left unknown, never guessed");
});

test("a parent must be on the list and above the place", () => {
  const p = base();
  assert.match(refused(p, { kind: "ADD_PLACE", name: "Pece", adminLevel: 4, parentName: "Nowhere" }), /Add it first/);
  assert.match(refused(p, { kind: "ADD_PLACE", name: "Region", adminLevel: 1, parentName: "Gulu" }), /below its parent/);
  assert.equal(applyPlaceOperation(p, { kind: "ADD_PLACE", name: "Pece", adminLevel: 4, parentName: "Gulu" }).ok, true, "a parent is matched the way places are everywhere: 'Gulu' is 'Gulu District'");
});

test("the same place under the same parent is added once, however it is spelt", () => {
  const p = base();
  assert.match(refused(p, { kind: "ADD_PLACE", name: "gulu", adminLevel: 2, parentName: "uganda" }), /already on the list/);
  assert.equal(applyPlaceOperation(p, { kind: "ADD_PLACE", name: "Gulu", adminLevel: 2, parentName: "Kenya" }).ok, false, "another parent that is not listed is still refused");
});

test("editing keeps the place the person's, validates the same way, and drops a stale pin when the name changes", () => {
  let p = base();
  p = { ...p, places: p.places.map((x, i) => (i === 1 ? { ...x, value: { ...x.value, latitude: 2.77, longitude: 32.3 } } : x)) };
  const same = run(p, { kind: "EDIT_PLACE", path: "places.1", patch: { adminLevel: 3 } });
  assert.equal(same.places[1].value.latitude, 2.77, "a pin stays when the name does not change");
  const renamed = run(p, { kind: "EDIT_PLACE", path: "places.1", patch: { name: "Kitgum" } });
  assert.equal(renamed.places[1].value.latitude, null);
  assert.equal(renamed.places[1].status, "EDITED");
  assert.match(refused(p, { kind: "EDIT_PLACE", path: "places.1", patch: { name: " " } }), /name/);
  assert.match(refused(p, { kind: "EDIT_PLACE", path: "places.1", patch: { parentName: "Gulu District" } }), /inside itself/);
  assert.match(refused(p, { kind: "EDIT_PLACE", path: "places.7", patch: {} }), /not in the project/);
  assert.match(refused(p, { kind: "EDIT_PLACE", path: "logframe.0", patch: {} }), /not in the project/);
});

test("places never change the proposal they were given", () => {
  const p = base();
  const before = JSON.stringify(p);
  applyPlaceOperation(p, { kind: "ADD_PLACE", name: "Pece", adminLevel: 4, parentName: "Gulu" });
  applyPlaceOperation(p, { kind: "EDIT_PLACE", path: "places.0", patch: { name: "Kenya" } });
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(names(p), ["Uganda", "Gulu District"]);
});

test("typed places close the places requirement; the project area and 'not used' close the rest", () => {
  const open = (d) => gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("places."));
  const d = { ...emptyDraft(), proposal: base() };
  assert.deepEqual(open(d), ["places.area"]);
  d.extras.projectArea = "Gulu District";
  assert.deepEqual(open(d), []);
  assert.deepEqual(open(emptyDraft()), ["places.decided", "places.area"]);
});
