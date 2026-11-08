import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FILTERS, canSelect, hasUnreviewed, pruneSelection, queryFor, selectRecommended, toggle, toggleGroup, toggleIn, withFilter,
} from "../../src/features/sector-library/domain/picker-state.ts";
import type { LibraryEntryView } from "../../src/features/sector-library/domain/library-dto.ts";

const entry = (id: string, over: Partial<LibraryEntryView> = {}): LibraryEntryView => ({
  id, sectorId: "WASH", group: "Water", name: id, definition: "x".repeat(20), kind: "COUNT", unit: "people", direction: "HIGHER", aggregation: "SUM", frequency: "Monthly", level: "OUTPUT",
  disaggregations: [], meansOfVerification: ["a"], dataSources: ["b"], sourceRef: { sourceId: "SPHERE_2018" }, recommended: false, tags: [], review: { status: "UNREVIEWED" }, version: 1,
  standardText: null, adopted: false, origin: "LIBRARY", reworded: false, ...over,
}) as LibraryEntryView;

test("an entry already in the project cannot be chosen again, one by one or by group", () => {
  const a = entry("A"); const b = entry("B", { adopted: true }); const c = entry("C");
  assert.equal(canSelect(b), false);
  assert.deepEqual([...toggleGroup(new Set(), [a, b, c])].sort(), ["A", "C"]);
  assert.deepEqual([...toggleGroup(new Set(["A", "C"]), [a, b, c])], [], "a second press clears the group");
  assert.deepEqual([...toggle(new Set(), "A")], ["A"]);
  assert.deepEqual([...toggle(new Set(["A"]), "A")], []);
});

test("select recommended adds only recommended entries that can be chosen; pruning drops what is no longer shown", () => {
  const list = [entry("A", { recommended: true }), entry("B"), entry("C", { recommended: true, adopted: true })];
  assert.deepEqual([...selectRecommended(new Set(), list)], ["A"]);
  assert.deepEqual([...pruneSelection(new Set(["A", "B", "GONE"]), list)].sort(), ["A", "B"]);
  assert.deepEqual([...pruneSelection(new Set(["C"]), list)], [], "an adopted entry is never kept selected");
});

test("filters become a query without empty parts, and a project makes adopted entries show", () => {
  assert.deepEqual(queryFor(EMPTY_FILTERS), {});
  const f = withFilter(withFilter(EMPTY_FILTERS, "text", "  water  "), "sectors", toggleIn([], "WASH" as never));
  assert.deepEqual(queryFor(f), { sectors: ["WASH"], text: "water" });
  assert.deepEqual(queryFor(f, "p1"), { projectId: "p1", includeAdopted: true, sectors: ["WASH"], text: "water" });
  assert.deepEqual(toggleIn(["a", "b"], "a"), ["b"]);
  assert.deepEqual(toggleIn(["a"], "b"), ["a", "b"]);
  assert.equal(queryFor({ ...EMPTY_FILTERS, reviewedOnly: true, withStandard: true }).reviewedOnly, true);
});

test("the unreviewed note is shown only when something shown is not reviewed", () => {
  assert.equal(hasUnreviewed([entry("A")]), true);
  assert.equal(hasUnreviewed([entry("A", { review: { status: "REVIEWED", reviewer: "x", reviewedOn: "2026-11-08" } })]), false);
  assert.equal(hasUnreviewed([]), false);
});
