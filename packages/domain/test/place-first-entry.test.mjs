import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PlaceTree, validateDisaggregation, parseDisaggregationJson, projectWideEntries, placeSplitEntries, setPlaceCells, placeCellValue, IndicatorUpdate,
  placeAgenda, placeSheet, placeSheetDiff, agendaPlaces, placeSheetTabs, parsePlaceSheetTabs, NOT_MEASURED_HERE, PLACE_SHEET_IDS_MARK,
} from "../dist/index.js";

const P = (id, name, adminLevel, parentId) => ({ id, name, kind: adminLevel === 4 ? "POINT" : "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false });
const tree = () => new PlaceTree([P("C", "Country", 0), P("A", "Province A", 1, "C"), P("D1", "District 1", 2, "A"), P("D2", "District 2", 2, "A"), P("V1", "Village 1", 4, "D1")]);
const loc = (placeId, category, value) => ({ dimension: "LOCATION", category, value, placeId });
const sex = (category, value, placeId) => ({ dimension: "SEX", category, value, ...(placeId ? { placeId } : {}) });

// ---- 57.1: splits inside places ----

test("a split inside a place adds up to that place's figure", () => {
  const ok = validateDisaggregation([loc("D1", "District 1", "10"), loc("D2", "District 2", "5"), sex("Female", "6", "D1"), sex("Male", "4", "D1")], { indicatorType: "NUMBER", periodAchievement: "15" });
  assert.equal(ok.ok, true);
  const bad = validateDisaggregation([loc("D1", "District 1", "10"), sex("Female", "6", "D1"), sex("Male", "3", "D1")], { indicatorType: "NUMBER", periodAchievement: "10" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.details.code, "PLACE_SPLIT_TOTAL_MISMATCH");
});

test("a split inside a place needs the place's figure, and is not counted in the project-wide split", () => {
  const orphan = validateDisaggregation([loc("D1", "District 1", "10"), sex("Female", "3", "D2")], { indicatorType: "NUMBER", periodAchievement: "10" });
  assert.equal(orphan.ok, false);
  assert.equal(orphan.error.details.code, "PLACE_SPLIT_WITHOUT_FIGURE");
  // The project-wide SEX split still has to add up to the total; the per-place one does not join it.
  const both = validateDisaggregation([loc("D1", "District 1", "10"), sex("Female", "6", "D1"), sex("Male", "4", "D1"), sex("Female", "6"), sex("Male", "4")], { indicatorType: "NUMBER", periodAchievement: "10" });
  assert.equal(both.ok, true);
});

test("old values without splits are read and validated exactly as before", () => {
  const entries = parseDisaggregationJson(JSON.stringify([loc("D1", "District 1", "4"), sex("Female", "4")]));
  assert.deepEqual(projectWideEntries(entries), entries);
  assert.deepEqual(placeSplitEntries(entries), []);
  assert.equal(validateDisaggregation(entries, { indicatorType: "NUMBER", periodAchievement: "4" }).ok, true);
});

test("the value hides splits inside places from readers and keeps them when a place's figure is unchanged", () => {
  const u = IndicatorUpdate.create({ id: "u", tenantId: "t", indicatorId: "i", reportingPeriodId: "p", periodAchievement: "15", cumulativeAchievement: "", createdById: "x",
    disaggregation: [loc("D1", "District 1", "10"), loc("D2", "District 2", "5"), sex("Female", "6", "D1"), sex("Male", "4", "D1")] });
  assert.equal(u.disaggregation.length, 2);
  assert.equal(u.placeSplits.length, 2);
  u.edit({ disaggregation: [loc("D1", "District 1", "10"), loc("D2", "District 2", "7")] });
  assert.equal(u.placeSplits.length, 2, "D1 unchanged: its split stays");
  u.edit({ disaggregation: [loc("D1", "District 1", "11"), loc("D2", "District 2", "7")] });
  assert.equal(u.placeSplits.length, 0, "D1 changed: its old split no longer fits and is dropped");
});

// ---- 57.1: one place's cell ----

test("a place cell is merged: other places kept, total added up, a cleared cell removed (never 0)", () => {
  const stored = [loc("D1", "District 1", "10"), loc("D2", "District 2", "5")];
  const r = setPlaceCells({ indicatorType: "NUMBER", stored, cells: [{ placeId: "D2", placeName: "District 2", value: "8" }] });
  assert.equal(r.total, "18");
  assert.equal(placeCellValue(r.entries, "D1"), "10");
  assert.equal(placeCellValue(r.entries, "D2"), "8");
  const cleared = setPlaceCells({ indicatorType: "NUMBER", stored: r.entries, cells: [{ placeId: "D1", placeName: "District 1", value: "" }, { placeId: "D2", placeName: "District 2", value: "" }] });
  assert.equal(cleared.total, "");
  assert.equal(cleared.entries.length, 0);
});

test("a rate keeps its typed total; its place figures are stored as recorded", () => {
  const r = setPlaceCells({ indicatorType: "PERCENTAGE", stored: [loc("D1", "District 1", "40")], cells: [{ placeId: "D2", placeName: "District 2", value: "60" }] });
  assert.equal(r.total, null);
  assert.equal(r.entries.length, 2);
});

test("the project-wide split is derived when every place carries one, else kept only while it still adds up", () => {
  const stored = [loc("D1", "District 1", "10"), sex("Female", "6", "D1"), sex("Male", "4", "D1")];
  const r = setPlaceCells({ indicatorType: "NUMBER", stored, cells: [{ placeId: "D2", placeName: "District 2", value: "5", splits: [{ dimension: "SEX", category: "Female", value: "2" }, { dimension: "SEX", category: "Male", value: "3" }] }] });
  const wide = projectWideEntries(r.entries).filter((e) => e.dimension === "SEX");
  assert.deepEqual(wide.map((e) => `${e.category}=${e.value}`).sort(), ["Female=8", "Male=7"]);
  assert.equal(validateDisaggregation(r.entries, { indicatorType: "NUMBER", periodAchievement: r.total }).ok, true);

  const old = [loc("D1", "District 1", "10"), sex("Female", "6"), sex("Male", "4")];
  const dropped = setPlaceCells({ indicatorType: "NUMBER", stored: old, cells: [{ placeId: "D2", placeName: "District 2", value: "5" }] });
  assert.equal(projectWideEntries(dropped.entries).some((e) => e.dimension === "SEX"), false);
  assert.equal(dropped.notices.length, 1);
});

// ---- 57.2 / 57.4: agenda and sheet ----

const indicator = (id, code, setting, extra = {}) => ({ id, code, name: `Indicator ${code}`, type: "NUMBER", setting, due: true, ...extra });

test("the agenda lists the open planned work at a place or inside it, and the indicators measured there", () => {
  const t = tree();
  const agenda = placeAgenda({
    placeId: "D1", period: { start: "2026-11-01", end: "2026-11-30" }, tree: t, areas: [{ placeId: "A" }],
    indicators: [indicator("i1", "1.1", { scope: "LEVEL", level: 2 }), indicator("i2", "1.2", { scope: "CHOSEN", placeIds: ["D2"] }), indicator("i3", "1.3", { scope: "PROJECT" })],
    values: [{ indicatorId: "i1", status: "DRAFT", breakdown: [loc("D1", "District 1", "7")] }],
    plan: [
      { id: "a", title: "Visit", status: "PLANNED", plannedStart: "2026-11-03", plannedEnd: "2026-11-03", placeIds: ["V1"] },
      { id: "b", title: "Done", status: "DONE", plannedStart: "2026-11-03", plannedEnd: "2026-11-03", placeIds: ["D1"] },
      { id: "c", title: "Elsewhere", status: "PLANNED", plannedStart: "2026-11-03", plannedEnd: "2026-11-03", placeIds: ["D2"] },
    ],
  });
  assert.deepEqual(agenda.activities.map((a) => a.id), ["a"]);
  assert.deepEqual(agenda.cells.map((c) => c.indicatorId), ["i1"]);
  assert.equal(agenda.cells[0].value, "7");
  assert.equal(agenda.cells[0].state, "DRAFT");
});

test("a verified value and a calculated indicator are locked; the places to start from are the open footprint", () => {
  const t = tree();
  const agenda = placeAgenda({ placeId: "D1", period: { start: "2026-11-01", end: "2026-11-30" }, tree: t, areas: [{ placeId: "A" }], plan: [],
    indicators: [indicator("i1", "1.1", { scope: "LEVEL", level: 2 }), indicator("i2", "1.2", { scope: "LEVEL", level: 2 }, { calculated: true })],
    values: [{ indicatorId: "i1", status: "VERIFIED", breakdown: [] }] });
  assert.deepEqual(agenda.cells.map((c) => c.lock).sort(), ["CALCULATED", "VERIFIED"]);
  assert.deepEqual(agendaPlaces([{ placeId: "A" }, { placeId: "C", closedAt: new Date() }], t).map((r) => r.placeId), ["A", "D1", "V1", "D2"].sort((a, b) => t.path(a).localeCompare(t.path(b))));
});

test("the sheet: rows = places, columns = by-place indicators, not-measured cells marked, totals for counts only", () => {
  const t = tree();
  const sheet = placeSheet({ tree: t, areas: [{ placeId: "A" }],
    indicators: [indicator("i1", "1.1", { scope: "LEVEL", level: 2 }), indicator("i2", "1.2", { scope: "CHOSEN", placeIds: ["D2"] }, { type: "PERCENTAGE" }), indicator("i3", "1.3", { scope: "PROJECT" })],
    values: [{ indicatorId: "i1", status: "DRAFT", breakdown: [loc("D1", "District 1", "7"), loc("D2", "District 2", "3")] }] });
  assert.deepEqual(sheet.columns.map((c) => c.indicatorId), ["i1", "i2"]);
  assert.deepEqual(sheet.rows.map((r) => r.placeId), ["D1", "D2"]);
  assert.equal(sheet.cells[0][1], NOT_MEASURED_HERE);
  assert.deepEqual(sheet.totals, ["10", null]);
  const edits = placeSheetDiff(sheet, new Map([["D1|i1", "9"], ["D1|i2", "50"], ["D2|i1", "3"]]));
  assert.deepEqual(edits, [{ placeId: "D1", indicatorId: "i1", value: "9" }]);
});

// ---- 57.5: the file ----

test("the file round-trips: what is typed in the tabs is read back; empty leaves alone; bad cells block and are named", () => {
  const t = tree();
  const sheet = placeSheet({ tree: t, areas: [{ placeId: "A" }], indicators: [indicator("i1", "1.1", { scope: "LEVEL", level: 2 })], values: [{ indicatorId: "i1", status: "DRAFT", breakdown: [loc("D1", "District 1", "7")] }] });
  const tabs = placeSheetTabs(sheet);
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].rows[1][0], PLACE_SHEET_IDS_MARK);
  const rows = tabs[0].rows.map((r) => [...r]);
  rows[2][3] = "7";   // D1 unchanged
  rows[3][3] = "12";  // D2 typed
  const read = parsePlaceSheetTabs(sheet, [{ name: tabs[0].name, rows }]);
  assert.deepEqual(read.problems, []);
  assert.deepEqual(read.edits, [{ placeId: "D2", indicatorId: "i1", value: "12" }]);
  assert.equal(read.unchanged, 1);
  rows[3][3] = "twelve";
  rows.push(["", "Nowhere", "Nowhere", "4"]);
  const bad = parsePlaceSheetTabs(sheet, [{ name: tabs[0].name, rows }]);
  assert.equal(bad.problems.length, 2);
});
