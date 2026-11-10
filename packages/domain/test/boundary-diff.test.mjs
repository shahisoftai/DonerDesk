import assert from "node:assert/strict";
import test from "node:test";
import { diffBoundaryVersions, isBoundaryDiffEmpty, placesAffectedByDiff } from "../dist/index.js";

const before = [
  { pcode: "SD01", name: "Khartoum" },
  { pcode: "SD0101", name: "Bahri", parentPcode: "SD01" },
  { pcode: "SD0102", name: "Omdurman", parentPcode: "SD01" },
  { pcode: "", name: "No code" },
];
const after = [
  { pcode: "sd01", name: "Khartoum" },
  { pcode: "SD0101", name: "Khartoum Bahri", parentPcode: "SD02" },
  { pcode: "SD0103", name: "Jebel Awlia", parentPcode: "SD01" },
];

test("boundary diff: codes are followed case-blind; appeared, disappeared, moved and renamed are told apart", () => {
  const d = diffBoundaryVersions(before, after);
  assert.deepEqual(d.appeared.map((r) => r.pcode), ["SD0103"]);
  assert.deepEqual(d.disappeared.map((r) => r.pcode), ["SD0102"]);
  assert.deepEqual(d.reparented, [{ pcode: "SD0101", name: "Khartoum Bahri", from: "SD01", to: "SD02" }]);
  assert.deepEqual(d.renamed, [{ pcode: "SD0101", from: "Bahri", to: "Khartoum Bahri" }]);
});

test("boundary diff: the same set twice is empty; a unit without a code is never reported", () => {
  assert.equal(isBoundaryDiffEmpty(diffBoundaryVersions(before, before)), true);
  assert.equal(isBoundaryDiffEmpty(diffBoundaryVersions([{ pcode: "", name: "A" }], [])), true);
});

test("boundary diff: places on a retired or moved code are listed to confirm, never changed", () => {
  const places = [{ id: "a", code: "SD0102" }, { id: "b", code: "sd0101" }, { id: "c", code: "SD01" }, { id: "d" }];
  const hits = placesAffectedByDiff(places, diffBoundaryVersions(before, after));
  assert.deepEqual(hits.map((h) => [h.place.id, h.reason]), [["a", "RETIRED"], ["b", "MOVED"]]);
  assert.equal(places[0].code, "SD0102");
});
