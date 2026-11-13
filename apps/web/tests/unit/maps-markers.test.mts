import assert from "node:assert/strict";
import test from "node:test";
import { placeMarkers, MARKER_LIMIT } from "../../src/features/maps/domain/scene/place-markers.ts";
import { MAP_OPTION_GROUPS, optionsIn } from "../../src/features/maps/domain/map-options.ts";
import { fitText, mapOnlyPages } from "../../src/features/maps/domain/map-page.ts";
import { tabOf } from "../../src/features/places/domain/where-we-work.ts";

const ind = (id: string, rows: Array<[string, string | null]>, o: object = {}) => ({ id, code: id, name: id, unit: "people", isRate: false, additive: true, rows: rows.map(([p, v]) => ({ placeId: p, name: p, value: v })), ...o });

test("a marker needs two to four indicators with one unit; a rate is never a pie", () => {
  assert.deepEqual(placeMarkers("BAR", [ind("a", [])]), { ok: false, refusal: "TOO_FEW" });
  assert.deepEqual(placeMarkers("BAR", [ind("a", []), ind("b", [], { unit: "kg" })]), { ok: false, refusal: "UNITS_DIFFER" });
  assert.deepEqual(placeMarkers("PIE", [ind("a", []), ind("b", [], { isRate: true })]), { ok: false, refusal: "RATE_IN_PIE" });
  assert.deepEqual(placeMarkers("PIE", [ind("a", []), ind("b", [], { additive: false })]), { ok: false, refusal: "PIE_NOT_ADDITIVE" });
  assert.equal(placeMarkers("NONE", []), null);
});

test("a place with any figure missing gets no marker and is counted; a gap is never 0", () => {
  const r = placeMarkers("BAR", [ind("a", [["x", "5"], ["y", "7"]]), ind("b", [["x", "1,000"], ["y", null]])]);
  assert.ok(r && r.ok);
  assert.equal(r.markers.length, 1);
  assert.equal(r.markers[0]!.total, 1005);
  assert.equal(r.withoutFull, 1);
});

test("too many places are refused, not drawn", () => {
  const rows = Array.from({ length: MARKER_LIMIT + 1 }, (_, i) => [`p${i}`, "1"] as [string, string]);
  assert.deepEqual(placeMarkers("BAR", [ind("a", rows), ind("b", rows)]), { ok: false, refusal: "TOO_MANY_PLACES" });
});

test("every map control is in one group; the basics are few", () => {
  assert.equal(optionsIn("BASIC").length + optionsIn("MORE").length, Object.keys(MAP_OPTION_GROUPS).length);
  assert.ok(optionsIn("BASIC").length <= 5);
  assert.ok(optionsIn("MORE").includes("layers"));
});

test("the map-only page is one full-width map bound to the project", () => {
  const [page] = mapOnlyPages({ projectId: "p1", indicatorId: "i1", title: "T", alt: "A" });
  assert.equal(page!.blocks.length, 1);
  assert.deepEqual(page!.blocks[0]!.bindings, [{ type: "PROJECT", slot: "project", projectId: "p1" }]);
  assert.equal(page!.blocks[0]!.props.indicatorId, "i1");
  assert.equal(page!.blocks[0]!.bounds.w, 12);
});

test("an unknown Where we work tab falls back to the first", () => {
  assert.equal(tabOf("points"), "points");
  assert.equal(tabOf("nonsense"), "areas");
  assert.equal(tabOf(undefined), "areas");
});

test("a long project name still makes a valid dashboard: page title 80, canvas title 120, a format is set", () => {
  const long = "[DEMO-16] Inclusive Quality Education for Out-of-School and Marginalised Children in Kenya's Arid Counties (IQE-KE): results by place";
  const [page] = mapOnlyPages({ projectId: "p", title: long, alt: long });
  assert.ok(page!.title.length <= 80);
  assert.equal(page!.format, "WEB_FLUID");
  assert.ok(fitText(long, 120).length <= 120);
  assert.equal(fitText("short", 80), "short");
});
