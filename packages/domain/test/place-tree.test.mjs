import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PlaceTree, insideFootprint, extensionFor, placesForNewWork, checkUntickArea, checkCloseArea, checkReopenArea, checkAddArea, areasInside, NO_DEPENDENTS,
  describeDependents, checkRecordPlaces, inheritPlaces, PLACE_LINK_RULES, RECORD_PLACE_KINDS, checkMerge, suggestDuplicates, whoWhatWhere, overlaps,
  placeSettingOf, checkPlaceSetting, entryRows, placeOfEntry, placeFigureEntries, withPlaceIds, followMerge, validateDisaggregation, parseDisaggregationJson,
  planBoundarySeed, PlaceRegistry, indicatorLocationRows, rollupByPlace,
} from "../dist/index.js";

// The plan's fixture "two-projects-one-village".
const P = (id, name, adminLevel, parentId, extra = {}) => ({ id, name, kind: adminLevel === 4 ? "POINT" : "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false, ...extra });
const PLACES = [
  P("C", "Country", 0),
  P("A", "Province A", 1, "C"), P("B", "Province B", 1, "C"),
  P("A1", "District A1", 2, "A"), P("A2", "District A2", 2, "A"), P("A3", "District A3", 2, "A"), P("B1", "District B1", 2, "B"),
  P("T", "Town T", 3, "A1"),
  P("V1", "Village 1", 4, "T"), P("V2", "Village 2", 4, "T"), P("V3", "Village 3", 4, "A2"), P("V4", "Village 4", 4, "A3"),
  P("CX", "Clinic X", 4, "B1", { facility: true }),
];
const tree = () => new PlaceTree(PLACES);
const areas = (...ids) => ids.map((placeId) => ({ placeId, closedAt: null }));

test("footprint: inside, outside, none and unknown", () => {
  const t = tree();
  assert.deepEqual(insideFootprint("V1", areas("A1", "A2"), t), { status: "INSIDE", areaId: "A1", closed: false });
  assert.equal(insideFootprint("V4", areas("A1", "A2"), t).status, "OUTSIDE");
  assert.equal(insideFootprint("V4", [], t).status, "NO_FOOTPRINT");
  assert.equal(insideFootprint("nope", areas("A1"), t).status, "UNKNOWN");
});

test("footprint: an open area wins over a closed one; closed areas are not offered for new work", () => {
  const t = tree();
  const fp = [{ placeId: "A", closedAt: new Date() }, { placeId: "A1", closedAt: null }];
  assert.deepEqual(insideFootprint("V1", fp, t), { status: "INSIDE", areaId: "A1", closed: false });
  const offered = placesForNewWork([{ placeId: "A1", closedAt: null }, { placeId: "A2", closedAt: new Date() }], t);
  assert.ok(offered.has("V1") && offered.has("T") && offered.has("A1"));
  assert.ok(!offered.has("V3") && !offered.has("A2"));
});

test("extension: the outside place's ancestor at the footprint's level, never invented", () => {
  const t = tree();
  assert.deepEqual(extensionFor("V4", areas("A1", "A2"), t), { placeId: "A3", name: "District A3", path: "District A3 › Province A › Country" });
  assert.equal(extensionFor("V1", areas("A1"), t), undefined);
  assert.equal(extensionFor("C", areas("A1"), t)?.placeId, "C"); // coarser than the level: the place itself
});

test("untick is refused while the project's records are inside, with the counts named", () => {
  assert.equal(checkUntickArea("District A1", NO_DEPENDENTS).ok, true);
  const r = checkUntickArea("District A1", { ...NO_DEPENDENTS, activities: 12, indicatorValues: 4 });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /12 completed activities and 4 indicator values/);
  assert.match(r.error.message, /close the area/);
  assert.equal(describeDependents({ ...NO_DEPENDENTS, evidence: 1 }), "1 file");
});

test("close needs a reason; reopen needs a closed area", () => {
  assert.equal(checkCloseArea({ placeId: "A1", closedAt: null }, "  ").ok, false);
  assert.equal(checkCloseArea({ placeId: "A1", closedAt: null }, "Funding ended here").value, "Funding ended here");
  assert.equal(checkCloseArea({ placeId: "A1", closedAt: new Date() }, "again").ok, false);
  assert.equal(checkReopenArea({ placeId: "A1", closedAt: null }).ok, false);
  assert.equal(checkReopenArea({ placeId: "A1", closedAt: new Date() }).ok, true);
});

test("adding an area: no repeat, nothing inside another; a broader one replaces the finer ones", () => {
  const t = tree();
  assert.equal(checkAddArea("A1", areas("A1"), t).ok, false);
  assert.match(checkAddArea("T", areas("A1"), t).error.message, /inside District A1/);
  assert.equal(checkAddArea("A", areas("A1", "B1"), t).ok, true);
  assert.deepEqual(areasInside("A", areas("A1", "A2", "B1"), t).map((a) => a.placeId), ["A1", "A2"]);
});

test("link rules: every kind has a row; inheritance fills and never overwrites", () => {
  for (const k of RECORD_PLACE_KINDS) assert.ok(PLACE_LINK_RULES[k]);
  const parent = [{ placeId: "V1", source: "CHOSEN" }, { placeId: "V2", source: "CHOSEN" }];
  assert.deepEqual(inheritPlaces("ACTIVITY", [], parent), [{ placeId: "V1", source: "INHERITED" }, { placeId: "V2", source: "INHERITED" }]);
  assert.deepEqual(inheritPlaces("ACTIVITY", [{ placeId: "V3", source: "CHOSEN" }], parent), [{ placeId: "V3", source: "CHOSEN" }]);
  assert.deepEqual(inheritPlaces("PLANNED_ACTIVITY", [], parent), []);
  assert.deepEqual(inheritPlaces("BENEFICIARY", [], parent), []);
});

test("record places: live places only, merges followed, repeats dropped, limits kept", () => {
  const merged = new PlaceTree([...PLACES, P("V1b", "Village One", 4, "T", { archived: true, mergedIntoId: "V1" })]);
  assert.deepEqual(checkRecordPlaces("ACTIVITY", ["V1b", "V1", "V2"], merged).value, ["V1", "V2"]);
  assert.equal(checkRecordPlaces("ACTIVITY", ["nope"], merged).ok, false);
  assert.equal(checkRecordPlaces("BENEFICIARY", ["V1", "V2"], merged).ok, false);
});

test("merge: same level only, never into its own inside, aliases and parent kept", () => {
  const extra = [...PLACES, P("V1dup", "Vilage 1", 4, undefined, { kind: "POINT" })];
  const t = new PlaceTree(extra);
  const plan = checkMerge("V1", "V1dup", t);
  assert.equal(plan.ok, true);
  assert.ok(plan.value.keepAfter.aliases.includes("Vilage 1"));
  assert.equal(checkMerge("A1", "V1", t).ok, false);
  assert.equal(checkMerge("A", "A1", t).ok, false);
  assert.equal(checkMerge("V1", "V1", t).ok, false);
  const swapped = checkMerge("V1dup", "V1", t);
  assert.equal(swapped.value.keepAfter.parentId, "T"); // a survivor with no parent takes the merged place's
});

test("duplicates: same name with nothing to tell them apart, or same code; never two villages in two districts", () => {
  const t = new PlaceTree([...PLACES, P("V1x", "village 1", 4), P("Vz", "Village 3", 4, "B1"), P("K1", "Kebele", 3, "A1", { code: "ET01" }), P("K2", "Kebele two", 3, "A2", { code: "et01" })]);
  const pairs = suggestDuplicates(t);
  assert.ok(pairs.some((p) => [p.keepId, p.mergeId].sort().join() === ["V1", "V1x"].sort().join() && p.reason === "SAME_NAME"));
  assert.ok(pairs.some((p) => p.reason === "SAME_CODE"));
  assert.ok(!pairs.some((p) => [p.keepId, p.mergeId].includes("Vz")));
});

test("who does what where: two projects in one village count once each, below-level records counted apart", () => {
  const t = tree();
  const projects = [{ id: "P1", name: "WASH", areas: areas("A1", "A2") }, { id: "P2", name: "Health", areas: areas("A1", "B1") }];
  const links = [
    { projectId: "P1", kind: "ACTIVITY", placeId: "V1" }, { projectId: "P1", kind: "ACTIVITY", placeId: "V3" },
    { projectId: "P2", kind: "PLANNED_ACTIVITY", placeId: "V1" }, { projectId: "P2", kind: "ACTIVITY", placeId: "CX" },
    { projectId: "P2", kind: "ACTIVITY", placeId: "C" },
  ];
  const r = whoWhatWhere(projects, links, t, 2);
  const a1 = r.areas.find((a) => a.placeId === "A1");
  assert.deepEqual(a1.projectIds, ["P1", "P2"]);
  assert.equal(a1.activities, 1);
  assert.equal(a1.plannedActivities, 1);
  assert.equal(r.notPlacedAtLevel, 1);
  assert.deepEqual(overlaps(r).map((a) => a.placeId), ["A1"]);
  const provinces = whoWhatWhere(projects, links, t, 1);
  assert.deepEqual(provinces.areas.find((a) => a.placeId === "A").projectIds, ["P1", "P2"]);
});

test("indicator place setting: older indicators read as before; the one check", () => {
  const t = tree();
  assert.deepEqual(placeSettingOf({ recordByPlace: true, placeLevel: 2 }), { scope: "LEVEL", level: 2, placeIds: [] });
  assert.deepEqual(placeSettingOf({}), { scope: "PROJECT" });
  assert.equal(checkPlaceSetting({ scope: "LEVEL", level: null }, t).ok, false);
  assert.equal(checkPlaceSetting({ scope: "CHOSEN", placeIds: [] }, t).ok, false);
  assert.deepEqual(checkPlaceSetting({ scope: "CHOSEN", placeIds: ["V1", "V1"] }, t).value.placeIds, ["V1"]);
});

test("entry rows: the footprint's places at the level; places with figures always stay", () => {
  const t = tree();
  const rows = entryRows({ scope: "LEVEL", level: 4 }, areas("A1"), t, ["V4"]);
  assert.deepEqual(rows.map((r) => r.placeId), ["V1", "V2", "V4"]);
  assert.deepEqual(entryRows({ scope: "CHOSEN", placeIds: ["CX", "V1"] }, [], t).map((r) => r.placeId), ["CX", "V1"]);
});

test("by-place figures carry ids; old name-only entries get one only on a unique match", () => {
  const t = new PlaceTree([...PLACES, P("V1other", "Village 1", 4, "B1")]);
  assert.deepEqual(placeFigureEntries([{ placeId: "V1", name: "Village 1", value: "12" }, { placeId: "V2", name: "Village 2", value: " " }]),
    [{ dimension: "LOCATION", category: "Village 1", value: "12", placeId: "V1" }]);
  assert.equal(placeOfEntry({ dimension: "LOCATION", category: "Village 1" }, t, ["V1", "V1other"]), undefined);
  assert.equal(placeOfEntry({ dimension: "LOCATION", category: "Village 1" }, t, ["V1", "V2"]), "V1");
  const { entries, added } = withPlaceIds([{ dimension: "LOCATION", category: "Village 2", value: "3" }, { dimension: "SEX", category: "F", value: "3" }], t, ["V2"]);
  assert.equal(added, 1);
  assert.equal(entries[0].placeId, "V2");
});

test("breakdown entries keep the place id, and two places of one name are not 'listed twice'", () => {
  const r = validateDisaggregation([
    { dimension: "LOCATION", category: "Village 1", value: "2", placeId: "V1" },
    { dimension: "LOCATION", category: "Village 1", value: "3", placeId: "V1other" },
  ], { indicatorType: "NUMBER", periodAchievement: "5" });
  assert.equal(r.ok, true);
  assert.equal(r.value[1].placeId, "V1other");
  assert.equal(parseDisaggregationJson(JSON.stringify(r.value))[0].placeId, "V1");
});

test("results by place group by id: a rename keeps one row, same-named villages stay apart", () => {
  const places = [...PLACES, P("V1other", "Village 1", 4, "B1")];
  const registry = new PlaceRegistry(places);
  const view = indicatorLocationRows({ type: "NUMBER" }, [
    { reportingPeriodId: "p1", verificationStatus: "VERIFIED", disaggregation: [{ dimension: "LOCATION", category: "Village 1", value: "2", placeId: "V1" }] },
    { reportingPeriodId: "p2", verificationStatus: "VERIFIED", disaggregation: [{ dimension: "LOCATION", category: "Village One (renamed)", value: "3", placeId: "V1" }, { dimension: "LOCATION", category: "Village 1", value: "7", placeId: "V1other" }] },
  ]);
  const roll = rollupByPlace(view, registry, 4);
  const byId = Object.fromEntries(roll.rows.map((r) => [r.placeId, r.value]));
  assert.equal(byId.V1, "5");
  assert.equal(byId.V1other, "7");
  assert.equal(roll.unplaced.length, 0);
});

test("merges are followed through chains; unknown ids stay unknown", () => {
  const all = new Map([["a", { id: "a", mergedIntoId: "b" }], ["b", { id: "b", mergedIntoId: "c" }], ["c", { id: "c" }]]);
  assert.equal(followMerge("a", all), "c");
  assert.equal(followMerge("x", all), undefined);
});

test("boundary seed answers the id of each unit, new or already listed", () => {
  let n = 0;
  const plan = planBoundarySeed({ name: "Country" }, [{ ref: "r1", level: 1, name: "Province A" }, { ref: "r2", parentRef: "r1", level: 2, name: "District New" }], new PlaceRegistry(PLACES), () => `new${++n}`);
  assert.equal(plan.idByRef.get("r1"), "A");
  assert.equal(plan.idByRef.get("r2"), plan.create[0].id);
});
