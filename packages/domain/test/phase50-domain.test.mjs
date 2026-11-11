import test from "node:test";
import assert from "node:assert/strict";
import {
  FILTER_DIMENSIONS, FILTER_DIMENSION_DEFS, toggleChoice, relativePeriodIds, encodeFilterSelection, decodeFilterSelection, forShareLink, cascadePlaces, placeOptionsUnder, filterControlProblems,
  effectOf, setInteraction, pruneInteractions, splitTargets, canvasStructureProblems, definitionFor,
  placeCallouts, validateMapWidget, bandFor,
  importThemeSpec, exportThemeSpec, buildTheme,
  facilityTypeProblem, facilityTypeListProblems, validatePlace,
} from "../dist/index.js";

test("every filter dimension has a definition; money words never pass through a share link", () => {
  for (const d of FILTER_DIMENSIONS) assert.ok(FILTER_DIMENSION_DEFS[d], d);
  for (const d of ["DONOR", "FUNDING_SOURCE", "PARTNER"]) assert.equal(FILTER_DIMENSION_DEFS[d].viaShareLink, false);
  assert.deepEqual(forShareLink({ PLACE: ["punjab"], DONOR: ["echo"], relativePeriod: "LAST_3" }), { PLACE: ["punjab"], relativePeriod: "LAST_3" });
});

test("choosing: single replaces, multi toggles, choosing everything is no filter", () => {
  let s = toggleChoice({}, "PLACE", "sindh", { multi: true, optionCount: 3 });
  s = toggleChoice(s, "PLACE", "punjab", { multi: true, optionCount: 3 });
  assert.deepEqual(s.PLACE, ["punjab", "sindh"]);
  assert.deepEqual(toggleChoice(s, "PLACE", "kp", { multi: true, optionCount: 3 }), {}, "all three = select all = no filter");
  assert.deepEqual(toggleChoice({ PERIOD: ["p1"], relativePeriod: "LATEST" }, "PERIOD", "p2", { multi: false, optionCount: 5 }), { PERIOD: ["p2"] });
  assert.deepEqual(toggleChoice({ PERIOD: ["p1"] }, "PERIOD", "p1", { multi: false, optionCount: 5 }), {});
});

test("relative periods are worked out from today, never stored", () => {
  const ps = [["p1", "2026-01-01", "2026-01-31"], ["p2", "2026-02-01", "2026-02-28"], ["p3", "2026-03-01", "2026-03-31"], ["p0", "2025-12-01", "2025-12-31"]].map(([id, startDate, endDate]) => ({ id, startDate, endDate }));
  assert.deepEqual(relativePeriodIds(ps, "LATEST", "2026-03-15"), ["p2"], "March has not ended");
  assert.deepEqual(relativePeriodIds(ps, "LAST_3", "2026-04-01"), ["p1", "p2", "p3"]);
  assert.deepEqual(relativePeriodIds(ps, "LAST_YEAR", "2026-04-01"), ["p0"]);
  assert.deepEqual(relativePeriodIds(ps, "THIS_YEAR", "2026-02-10").sort(), ["p1", "p2"]);
});

test("the page address round-trips, drops what it does not know, and is one address per choice", () => {
  const sel = { PLACE: ["sindh", "punjab, east"], PERIOD: ["p3"], relativePeriod: "LAST_6" };
  const enc = encodeFilterSelection({ ...sel, PLACE: [...sel.PLACE].sort() });
  assert.deepEqual(decodeFilterSelection(enc), { PERIOD: ["p3"], PLACE: ["punjab, east", "sindh"], relativePeriod: "LAST_6" });
  assert.deepEqual(decodeFilterSelection("NOPE:x~PLACE:%E0%A4%A~rel:FOREVER~SECTOR:wash"), { SECTOR: ["wash"] });
  assert.deepEqual(decodeFilterSelection(null), {});
});

test("places cascade: a district stays only while inside the province chosen", () => {
  const tree = [{ key: "punjab", parentKey: null }, { key: "lahore", parentKey: "punjab" }, { key: "karachi", parentKey: "sindh" }, { key: "sindh", parentKey: null }];
  assert.deepEqual(cascadePlaces({ PLACE: ["lahore", "karachi"] }, tree, ["punjab"]), ["lahore"]);
  assert.deepEqual(placeOptionsUnder([{ key: "lahore", parentKey: "punjab" }, { key: "karachi", parentKey: "sindh" }], tree, ["sindh"]).map((o) => o.key), ["karachi"]);
  assert.deepEqual(filterControlProblems({ dimension: "PERIOD", multi: true }), ["This filter takes one choice."]);
  assert.ok(filterControlProblems({ dimension: "PLACE", levels: [2, 1] }).length === 1);
  assert.deepEqual(filterControlProblems({ dimension: "PLACE", levels: [1, 2], style: "TILES", multi: true }), []);
});

test("the filter bar block checks its controls", () => {
  const v = (p) => definitionFor("FILTER_BAR").validate(p);
  assert.deepEqual(v({ dimensions: ["PLACE", "DONOR"], controls: [{ dimension: "PLACE", levels: [1, 2] }] }), []);
  assert.equal(v({ dimensions: ["PLACE", "PLACE"] }).length, 1);
  assert.equal(v({ dimensions: ["PLACE"], controls: [{ dimension: "DONOR" }] }).length, 1);
});

const canvasOf = (blocks, interactions) => ({ id: "c", scope: "PROJECT", mode: "LIVE", profile: "INTERNAL", title: "T", language: "en", themeId: "DEFAULT", revision: 1, interactions, pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks }] });
const blk = (id, kind, props) => ({ id, kind, bounds: { x: 0, y: 0, w: 4, h: 2 }, props, bindings: [] });

test("interactions: FILTER by default, exceptions only stored, a map cannot highlight, removed blocks are cleaned", () => {
  const bar = blk("bar", "CHART", { spec: { kind: "BAR" } });
  const line = blk("line", "CHART", { spec: { kind: "LINE" } });
  const table = blk("t", "TABLE", {});
  let c = canvasOf([bar, line, table]);
  assert.equal(effectOf(c, "bar", "t"), "FILTER");
  assert.equal(effectOf(c, "bar", "bar"), "NONE");
  c = setInteraction(c, "line", "t", "HIGHLIGHT");
  assert.equal(effectOf(c, "line", "t"), "HIGHLIGHT");
  assert.equal(setInteraction(c, "bar", "line", "HIGHLIGHT"), null, "a line chart cannot highlight");
  c = setInteraction(c, "bar", "line", "NONE");
  assert.deepEqual(splitTargets(c, "bar"), { filter: ["t"], highlight: [] });
  assert.equal(setInteraction(c, "line", "t", "FILTER").interactions?.line, undefined, "back to the default stores nothing");
  const bad = canvasOf([bar, line], { bar: { line: "HIGHLIGHT" } });
  assert.ok(canvasStructureProblems(bad).some((p) => /cannot highlight/.test(p.message)));
  assert.deepEqual(pruneInteractions(canvasOf([bar], { bar: { gone: "NONE" }, gone: { bar: "NONE" } })).interactions, undefined);
});

test("callouts: deterministic, never overlapping, inside the view, spill to a side column", () => {
  const view = { w: 600, h: 400 }, card = { w: 120, h: 60 };
  const anchors = [{ key: "a", x: 300, y: 200 }, { key: "b", x: 310, y: 205 }, { key: "c", x: 50, y: 50 }, { key: "d", x: 550, y: 350 }];
  const one = placeCallouts(anchors, view, card), two = placeCallouts([...anchors].reverse(), view, card);
  assert.deepEqual(one, two);
  for (const b of one) { assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= view.w && b.y + b.h <= view.h, b.key); }
  for (let i = 0; i < one.length; i++) for (let j = i + 1; j < one.length; j++) { const a = one[i], b = one[j]; assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `${a.key}/${b.key}`); }
  const crowded = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, x: 300, y: 200 }));
  const placed = placeCallouts(crowded, view, card);
  assert.equal(placed.length, 12);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) { const a = placed[i], b = placed[j]; assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `${a.key}/${b.key}`); }
  assert.ok(placed.every((b) => !b.inColumn), "there is room, so each card is placed near its place");
  // A view with no free spot left sends the rest to a side column, still joined to their places.
  const tight = placeCallouts(Array.from({ length: 6 }, (_, i) => ({ key: `t${i}`, x: 100, y: 100 })), { w: 260, h: 130 }, card);
  assert.ok(tight.some((b) => b.inColumn));
});

test("map styling: category needs a level, rules need ordered bands, a gap has no band", () => {
  assert.equal(validateMapWidget({ view: "RESULTS", colorBy: "CATEGORY", categoryLevel: 1 }), null);
  assert.match(validateMapWidget({ view: "RESULTS", colorBy: "CATEGORY" }), /level/);
  const bands = [{ from: null, to: 10, color: "#ff0000" }, { from: 10, to: null, color: "#00ff00" }];
  assert.equal(validateMapWidget({ view: "RESULTS", colorBy: "RULES", bands }), null);
  assert.match(validateMapWidget({ view: "RESULTS", colorBy: "RULES", bands: [...bands].reverse() }), /low to high/);
  assert.equal(bandFor(null, bands), null);
  assert.equal(bandFor(0, bands).color, "#ff0000");
  assert.equal(bandFor(10, bands).color, "#00ff00");
  const callouts = { placeKeys: ["punjab"], items: [{ source: { kind: "COUNT", metric: "DONORS" } }], columns: 3 };
  assert.equal(validateMapWidget({ view: "RESULTS", callouts }), null);
  assert.match(validateMapWidget({ view: "ACTIVITIES", callouts }), /results map/);
});

test("theme files: round trip, unknown keys and weak contrast refused, semantic colours fitted", () => {
  const spec = { id: "ngo", label: "NGO", description: "", accent: "#7b2d8b", semantic: { good: "#15803d" } };
  const back = importThemeSpec(exportThemeSpec(spec));
  assert.ok(back.ok, JSON.stringify(back));
  assert.equal(back.spec.accent, "#7b2d8b");
  assert.ok(!importThemeSpec('{"id":"x","label":"X","accent":"#123456","colour":"red"}').ok);
  assert.ok(!importThemeSpec('{"id":"x","label":"X","accent":"red"}').ok);
  assert.ok(!importThemeSpec('{"id":"x","label":"X","accent":"#123456","font":"comic-sans"}').ok);
  assert.ok(!importThemeSpec("not json").ok);
  const t = buildTheme(spec);
  for (const k of ["good", "bad", "neutral"]) assert.match(t.semantic[k], /^#[0-9a-f]{6}$/i);
});

test("facility types: only on a facility, keys normalised, list checked", () => {
  assert.equal(facilityTypeProblem({ facility: false, facilityType: "OTP" }), "Only a place marked as a facility has a facility type");
  assert.equal(facilityTypeProblem({ facility: true, facilityType: "OTP" }), null);
  assert.deepEqual(facilityTypeListProblems([{ key: "OTP", label: "OTP" }, { key: "SC", label: "SC" }]), []);
  assert.ok(facilityTypeListProblems([{ key: "otp", label: "x" }]).length > 0);
  const r = validatePlace({ id: "p", name: "Site", kind: "POINT", adminLevel: 4, aliases: [], archived: false, facilityType: "OTP" }, []);
  assert.equal(r.ok, false);
});

test("a card a person dropped stays exactly there; the others go around it; far rings come before the side column", () => {
  const view = { w: 600, h: 400 }, card = { w: 120, h: 60 };
  const boxes = placeCallouts([{ key: "a", x: 300, y: 200, fixed: { dx: 10, dy: -100 } }, { key: "b", x: 305, y: 150 }], view, card);
  const a = boxes.find((b) => b.key === "a"), b = boxes.find((x) => x.key === "b");
  assert.deepEqual([a.x, a.y, a.fixed], [310, 100, true]);
  assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), "the auto card avoids the fixed one");
  assert.deepEqual(placeCallouts([{ key: "e", x: 10, y: 10, fixed: { dx: -500, dy: -500 } }], view, card).map((b) => [b.x, b.y]), [[0, 0]], "a dropped card is kept inside the view");
  // An anchor in a corner whose near ring is off the map is placed on a wider ring, not in the side column.
  const corner = placeCallouts([{ key: "k", x: 590, y: 10 }], view, card);
  assert.equal(corner[0].inColumn, false);
  const sized = placeCallouts([{ key: "t", x: 300, y: 200, size: { w: 80, h: 30 } }], view, card);
  assert.deepEqual([sized[0].w, sized[0].h], [80, 30]);
});

test("text cards and dropped offsets are checked", () => {
  const base = { view: "RESULTS", callouts: { placeKeys: [], items: [], columns: 3, texts: [{ id: "t1", placeKey: "humla", text: "Road cut by landslide" }] } };
  assert.equal(validateMapWidget(base), null);
  assert.match(validateMapWidget({ ...base, callouts: { ...base.callouts, texts: [{ id: "t1", placeKey: "humla", text: "" }] } }), /text card/);
  assert.match(validateMapWidget({ ...base, callouts: { ...base.callouts, offsets: { t1: { dx: 9000, dy: 0 } } } }), /too far/);
  assert.match(validateMapWidget({ view: "RESULTS", callouts: { placeKeys: [], items: [], columns: 3 } }), /text card/);
});
