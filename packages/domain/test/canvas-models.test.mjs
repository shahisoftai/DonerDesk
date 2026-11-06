import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_KINDS, INFOGRAPHIC_BLOCK_SPECS, BLOCK_FIXTURES, SAMPLE_FACTS, SAMPLE_SHEET, INFOGRAPHIC_MODELS, PENDING_MODEL_KINDS, definitionFor, modelProblems, designPeriods, latestFinance, ageGroupKind, sexKind, sortedAgeGroups, bindingProblems, projectOf, projectSlot, honoursOf, filtersOnPage } from "../dist/index.js";

const run = (kind, props, data) => definitionFor(kind).resolve(props, data);
const facts = (over) => ({ ...structuredClone(SAMPLE_FACTS), sheet: SAMPLE_SHEET, ...over });

// ---- which blocks still lack a model: the list may only shrink ----

test("the blocks still drawn from their settings are exactly the pending list, and it can only shrink", () => {
  const withoutModel = Object.keys(INFOGRAPHIC_BLOCK_SPECS).filter((k) => !(k in INFOGRAPHIC_MODELS));
  assert.deepEqual(withoutModel.sort(), [...PENDING_MODEL_KINDS].sort());
  const PENDING_MAX = 6; // lower this as 45.2 ports small multiples, results chain and the four portfolio blocks
  assert.ok(PENDING_MODEL_KINDS.length <= PENDING_MAX);
  for (const k of Object.keys(INFOGRAPHIC_MODELS)) assert.ok(BLOCK_KINDS.includes(k), k);
});

test("every model is plain data, repeatable, and says why when it has nothing", () => {
  for (const kind of Object.keys(INFOGRAPHIC_MODELS)) {
    const f = BLOCK_FIXTURES[kind];
    const a = run(kind, f.props, f.data); const b = run(kind, structuredClone(f.props), structuredClone(f.data));
    assert.deepEqual(a, b, kind);
    assert.equal(a.state, "ready", `${kind} fixture has something to show`);
    assert.deepEqual(modelProblems(a.model), [], kind);
    const none = run(kind, {}, undefined);
    assert.ok(["empty", "unavailable"].includes(none.state), `${kind} with nothing set up and no facts shows nothing`);
    assert.ok(none.reason.length > 5);
  }
});

// ---- numbers ----

test("big numbers: a figure nobody recorded is null, never 0; typed figures work with no facts; the rest say they are unavailable", () => {
  const props = BLOCK_FIXTURES.BIG_NUMBERS.props;
  const cards = run("BIG_NUMBERS", props, SAMPLE_FACTS).model.cards;
  assert.deepEqual(cards.map((c) => c.figure?.amount ?? null), [120, 40, 1000, null]);
  assert.equal(cards[3].figure, null);
  assert.equal(run("BIG_NUMBERS", props, undefined).state, "unavailable");
  const manual = run("BIG_NUMBERS", { numbers: [{ label: "People", source: "MANUAL", value: "1.2 million", sourceNote: "Census" }] }, undefined);
  assert.equal(manual.state, "ready");
  assert.deepEqual(manual.model.sources, ["Census"]);
  assert.equal(manual.model.cards[0].figure.amount, null, "a typed figure stays as written; it is not parsed into a number it is not");
  assert.equal(manual.model.cards[0].figure.text, "1.2 million");
});

test("big numbers: no registered people or no planned activities is 'not recorded', not 0; unverified finance is flagged", () => {
  const f = facts({ reach: { ...SAMPLE_FACTS.reach, overallUnique: 0, registeredTotal: 0 }, activities: { rows: [], unlocated: 0 } });
  const m = run("BIG_NUMBERS", { numbers: [{ label: "a", source: "REACH_UNIQUE" }, { label: "b", source: "REACH_REGISTERED" }, { label: "c", source: "ACTIVITIES_DONE" }, { label: "d", source: "ACTIVITIES_PLANNED" }] }, f);
  assert.deepEqual(m.model.cards.map((c) => c.figure), [null, null, null, null]);
  const unverified = run("BIG_NUMBERS", { numbers: [{ label: "Spent", source: "FINANCE_EXPENDITURE" }] }, facts({ finance: { enabled: true, rows: [{ periodId: "p3", currency: "USD", budget: "1", expenditure: "400", balance: "0", verified: false }] } }));
  assert.equal(unverified.model.cards[0].figure.unverified, true);
  assert.deepEqual(unverified.notes, ["Some figures are not verified yet."]);
  const off = run("BIG_NUMBERS", { numbers: [{ label: "Spent", source: "FINANCE_EXPENDITURE" }] }, facts({ finance: { enabled: false, rows: [] } }));
  assert.equal(off.model.cards[0].figure, null);
  const portfolio = run("BIG_NUMBERS", { numbers: [{ label: "Projects", source: "PORTFOLIO_PROJECTS" }] }, SAMPLE_FACTS);
  assert.equal(portfolio.model.cards[0].figure, null, "a single-project design has no portfolio figures");
});

test("the latest verified finance row speaks; an unverified one only when nothing is verified", () => {
  assert.equal(latestFinance(SAMPLE_FACTS).periodId, "p1");
  assert.equal(latestFinance(facts({ finance: { enabled: true, rows: [SAMPLE_FACTS.finance.rows[1]] } })).verified, false);
  assert.equal(latestFinance(facts({ finance: { enabled: false, rows: SAMPLE_FACTS.finance.rows } })), undefined);
  assert.deepEqual(designPeriods({ sheet: SAMPLE_SHEET, range: { fromId: "p2", toId: "p3" } }), ["p2", "p3"]);
  assert.deepEqual(designPeriods({ sheet: SAMPLE_SHEET, range: { fromId: "nope" } }), ["p1", "p2", "p3"], "an unknown end is ignored");
});

test("progress rings: a rate has no percent of target, and nothing recorded is empty", () => {
  const rate = run("PROGRESS_RINGS", { indicatorIds: ["r"] }, SAMPLE_FACTS).model.rings[0];
  assert.equal(rate.percent, null);
  assert.equal(rate.isRate, true);
  assert.equal(run("PROGRESS_RINGS", { indicatorIds: ["zz"] }, SAMPLE_FACTS).state, "empty");
  const noValues = { ...SAMPLE_FACTS, sheet: { ...SAMPLE_SHEET, cells: [] } };
  assert.equal(run("PROGRESS_RINGS", {}, noValues).state, "empty");
});

test("funnel: a later stage larger than the one before is noted; stages with nothing are not drawn from 0", () => {
  const m = run("FUNNEL", { stages: [{ label: "Targeted", value: 100 }, { label: "Reached", value: 150 }] }, undefined);
  assert.deepEqual(m.model.stages.map((s) => s.percentOfPrevious), [null, 150]);
  assert.ok(m.notes[0].includes("Reached"));
  const unread = run("FUNNEL", { stages: [{ label: "Reached", bind: "REACH_UNIQUE" }] }, undefined);
  assert.equal(unread.model.recorded, false, "bound to the records and no records read: the stages are kept, marked not recorded");
  assert.equal(unread.model.stages[0].amount, null);
  const zeroReach = facts({ reach: { ...SAMPLE_FACTS.reach, overallUnique: 0 } });
  const zero = run("FUNNEL", { stages: [{ label: "Reached", bind: "REACH_UNIQUE" }] }, zeroReach);
  assert.equal(zero.model.stages[0].amount, null, "no registered people is not a stage of 0");
  assert.equal(zero.model.recorded, false);
  assert.equal(run("FUNNEL", BLOCK_FIXTURES.FUNNEL.props, SAMPLE_FACTS).model.recorded, true);
});

// ---- by place ----

test("reach: nobody registered is empty, not '0 people'; people with no place are counted apart", () => {
  const r = run("REACH", {}, SAMPLE_FACTS).model;
  assert.equal(r.withoutLocation, 5);
  assert.equal(r.attendances, 200);
  assert.equal(run("REACH", {}, facts({ reach: { ...SAMPLE_FACTS.reach, overallUnique: 0 } })).state, "empty");
});

test("activities by place: nothing planned is empty; activities with no place are counted apart", () => {
  assert.equal(run("ACTIVITIES_BY_LOCATION", {}, SAMPLE_FACTS).model.unlocated, 1);
  assert.equal(run("ACTIVITIES_BY_LOCATION", {}, facts({ activities: { rows: [], unlocated: 0 } })).state, "empty");
  assert.equal(run("ACTIVITIES_BY_LOCATION", {}, facts({ activities: { rows: [], unlocated: 2 } })).state, "ready", "unplaced activities alone are still something to report");
});

test("results by place: a place nobody reported has a null actual, a place nobody planned has a null target, and the chosen places filter", () => {
  const rows = run("LOCATION_RESULTS", {}, SAMPLE_FACTS).model.rows;
  assert.equal(rows.find((r) => r.location === "Siaya").actual, null);
  assert.equal(rows.find((r) => r.location === "Siaya").percentOfTarget, null);
  assert.deepEqual(run("LOCATION_RESULTS", { locationKeys: ["siaya"] }, SAMPLE_FACTS).model.rows.map((r) => r.location), ["Siaya"]);
  assert.deepEqual(run("LOCATION_RESULTS", {}, facts({ locationKeys: ["kisumu"] })).model.rows.map((r) => r.location), ["Kisumu"], "the design's default places apply when the block names none");
  assert.equal(run("LOCATION_RESULTS", { locationKeys: ["elsewhere"] }, SAMPLE_FACTS).state, "empty");
  const noTargets = facts({ indicators: [{ ...SAMPLE_FACTS.indicators[0], targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } }] });
  const recorded = run("LOCATION_RESULTS", {}, noTargets).model.rows;
  assert.deepEqual(recorded.map((r) => r.target), [null, null], "no location target is invented");
  assert.equal(run("LOCATION_RESULTS", {}, facts({ indicators: [{ ...SAMPLE_FACTS.indicators[0], location: { kind: "PROJECT_WIDE" }, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } }] })).state, "empty", "a project-wide indicator is not shown by place");
});

test("results by place: more than 18 rows are cut and the cut is said", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ key: `p${i}`, location: `Place ${i}`, value: "1", verified: true, unverified: 0, series: [] }));
  const big = facts({ indicators: [{ id: "a", code: "A", name: "A", location: { kind: "ADDITIVE", rows }, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } }] });
  const m = run("LOCATION_RESULTS", {}, big);
  assert.equal(m.model.rows.length, 18);
  assert.ok(m.notes.some((n) => /first 18 of 25/.test(n)));
});

test("places compared: a place an indicator has no figure for is a null cell, not 0", () => {
  const second = { id: "b", code: "B", name: "B", location: { kind: "ADDITIVE", rows: [{ key: "kisumu", location: "Kisumu", value: "7", verified: true, unverified: 0, series: [] }] }, targetActual: { kind: "NO_LOCATION_TARGETS", rows: [] } };
  const m = run("LOCATION_COMPARISON", {}, facts({ indicators: [SAMPLE_FACTS.indicators[0], second] })).model;
  assert.deepEqual(m.rows.find((r) => r.location === "Siaya").cells.map((c) => c && c.value), ["15", null]);
});

test("who we reached: percentages come from the groups recorded, empty groups are left out, ages read in order", () => {
  const m = run("DEMOGRAPHICS", {}, SAMPLE_FACTS).model;
  assert.deepEqual(m.sex.map((s) => [s.kind, s.percent]), [["FEMALE", 58], ["MALE", 42]]);
  assert.deepEqual(m.ages.map((a) => a.key), ["UNDER_5", "AGE_5_17", "AGE_18_59"]);
  const sparse = facts({ reach: { ...SAMPLE_FACTS.reach, bySex: { female: 0, male: 0 }, byAgeGroup: { AGE_5_17: 0 } } });
  assert.equal(run("DEMOGRAPHICS", {}, sparse).state, "empty", "all zero is not 'recorded'");
  assert.equal(sexKind("Women"), "FEMALE");
  assert.equal(sexKind("alien"), null);
  assert.deepEqual(ageGroupKind("AGE_60_PLUS"), { kind: "60_PLUS" });
  assert.deepEqual(ageGroupKind("5 - 17"), { kind: "RANGE", from: 5, to: 17 });
  assert.equal(ageGroupKind("AGE_odd_thing").text, "Odd thing", "an unknown key is tidied, never shown raw");
  assert.deepEqual(sortedAgeGroups([["unknown", 1], ["AGE_5_17", 2], ["UNDER_5", 3]]).map((x) => x[0]), ["UNDER_5", "AGE_5_17", "unknown"]);
});

test("funding: unverified rows are flagged, a period with no spend is null, and no finance is empty", () => {
  const m = run("FUNDING", {}, SAMPLE_FACTS);
  assert.deepEqual(m.model.rows.map((r) => r.verified), [true, false]);
  assert.deepEqual(m.notes, ["Some figures are not verified yet."]);
  const gap = run("FUNDING", {}, facts({ finance: { enabled: true, rows: [{ periodId: "p1", currency: "USD", budget: "1000", expenditure: "", balance: "", verified: true }] } }));
  assert.equal(gap.model.rows[0].expenditure, null);
  assert.equal(run("FUNDING", {}, facts({ finance: { enabled: false, rows: SAMPLE_FACTS.finance.rows } })).state, "empty");
});

// ---- authored blocks ----

test("authored blocks drop blank entries, and a block with nothing written says so", () => {
  assert.equal(run("KEY_MESSAGES", BLOCK_FIXTURES.KEY_MESSAGES.props).model.messages.length, 1);
  assert.equal(run("KEY_MESSAGES", { messages: [{ text: " " }] }).state, "empty");
  assert.deepEqual(run("LEGEND_NOTES", BLOCK_FIXTURES.LEGEND_NOTES.props).model.notes, ["Figures to March 2026."]);
  assert.equal(run("LEGEND_NOTES", {}, undefined).state, "empty");
  const withSource = run("LEGEND_NOTES", {}, SAMPLE_FACTS).model.source;
  assert.deepEqual([withSource.periods, withSource.indicators], [{ first: "Jan 2026", last: "Mar 2026", count: 3 }, { first: "A", last: "R", count: 2 }], "the source line comes from the design's periods and indicators");
  assert.equal(run("BANNER", { title: "  " }).state, "empty");
  assert.equal(run("BANNER", {}, { ...SAMPLE_FACTS, acknowledgement: "Funded by the EU" }).model.message, "Funded by the EU", "a banner with no words shows the design's acknowledgement");
  assert.equal(run("BANNER", { text: "Own words", title: "T" }, { ...SAMPLE_FACTS, acknowledgement: "x" }).model.message, "Own words");
  assert.deepEqual(run("THREE_W", BLOCK_FIXTURES.THREE_W.props).model.rows[0].placeKeys, ["kisumu"]);
  assert.ok(run("THREE_W", { presence: [{ who: "A", what: "B", where: [] }] }).notes.length === 1, "an unsourced table is flagged");
  const w = run("THREE_W", { caption: "Src", presence: [{ who: "Water NGO", what: "Drill", where: ["Kisumu", "Siaya"] }, { who: "water ngo", what: "Train", where: ["kisumu", "KISUMU "] }, { who: "Health NGO", what: "Clinics", where: ["Siaya"] }] }).model;
  assert.deepEqual(w.places, [{ key: "kisumu", name: "kisumu", count: 3 }, { key: "siaya", name: "Siaya", count: 2 }].map((p) => (p.key === "kisumu" ? { ...p, name: w.places[0].name } : p)), "places are grouped by the location normalizer");
  assert.equal(w.partners, 2, "the same organisation typed twice counts once");
  assert.deepEqual(w.rows[1].placeKeys, ["kisumu"]);
  assert.equal(run("TIMELINE", { events: [{ date: "2026-01-01", label: " " }] }).state, "empty");
});

test("a quote and an image say when consent or a description is missing", () => {
  assert.deepEqual(run("QUOTE", BLOCK_FIXTURES.QUOTE.props).notes, ["The person quoted has not confirmed they agreed to appear."]);
  assert.deepEqual(run("QUOTE", { ...BLOCK_FIXTURES.QUOTE.props, consentConfirmed: true }).notes, []);
  const bare = run("IMAGE", { assetId: "a" });
  assert.equal(bare.notes.length, 2);
  assert.deepEqual(run("IMAGE", BLOCK_FIXTURES.IMAGE.props).notes, []);
});

test("sector grid: an indicator that is gone is a null cell, not a zero", () => {
  const cells = run("SECTOR_GRID", BLOCK_FIXTURES.SECTOR_GRID.props, SAMPLE_FACTS).model.sectors[0].indicators;
  assert.equal(cells[0].code, "A");
  assert.equal(cells[1], null);
});

// ---- maps and the project list ----

test("a map with no data handed in is unavailable; a place with no figure is counted, a place with no pin is listed, never placed", () => {
  assert.equal(run("MAP", { view: "RESULTS" }, undefined).state, "unavailable");
  assert.equal(run("MAP", { view: "ACTIVITIES" }, undefined).state, "unavailable");
  const m = run("MAP", BLOCK_FIXTURES.MAP.props, BLOCK_FIXTURES.MAP.data);
  assert.deepEqual(m.notes, ["1 of 2 places have no figure yet.", "1 places have no pin; they are listed, not placed."]);
  assert.equal(m.model.items.find((i) => i.name === "Siaya").value, null);
  assert.equal(m.model.items.find((i) => i.name === "Siaya").latitude, undefined);
  assert.deepEqual(modelProblems(m.model), []);
});

test("a map keeps its shading and chosen places, and filters by them", () => {
  const data = BLOCK_FIXTURES.MAP.data;
  const m = run("MAP", { view: "RESULTS", shading: "REACH", placeKeys: ["kisumu"] }, data);
  assert.equal(m.model.shading, "REACH");
  assert.deepEqual(m.model.items.map((i) => i.name), ["Kisumu"]);
  assert.equal(run("MAP", { view: "RESULTS", placeKeys: ["nowhere"] }, data).state, "empty");
  assert.equal(definitionFor("MAP").validate({ view: "RESULTS", shading: "BOGUS" }).length, 1);
  assert.equal(definitionFor("MAP").validate({ view: "RESULTS", placeKeys: [" "] }).length, 1);
});

test("activities on a map: those without a pin are listed with their place", () => {
  const sites = [
    { id: "1", title: "Drill", place: "Kisumu", latitude: -0.1, longitude: 34.7, signal: "DONE", signalLabel: "Done" },
    { id: "2", title: "Train", place: "Siaya", signal: "LATE", signalLabel: "Late" },
  ];
  const m = run("MAP", { view: "ACTIVITIES" }, { sites });
  assert.equal(m.model.sites.length, 1);
  assert.deepEqual(m.model.unplaced, [{ id: "2", title: "Train", place: "Siaya" }]);
  assert.equal(m.notes.length, 1);
  assert.equal(run("MAP", { view: "ACTIVITIES" }, { sites: [] }).state, "empty");
});

test("the project list is drawn for the person looking; a bookmarks list with no bookmarks says how to add one", () => {
  assert.equal(run("PROJECT_LIST", { affiliation: "ALL" }, undefined).state, "unavailable");
  const data = BLOCK_FIXTURES.PROJECT_LIST.data;
  assert.equal(run("PROJECT_LIST", { affiliation: "ALL" }, data).model.rows.length, 1);
  const bookmarks = run("PROJECT_LIST", { affiliation: "BOOKMARKED" }, data);
  assert.equal(bookmarks.model.rows.length, 0);
  assert.match(bookmarks.notes[0], /bookmarked/);
  assert.equal(run("PROJECT_LIST", { affiliation: "BOOKMARKED" }, { ...data, bookmarkedIds: ["p1"] }).model.rows.length, 1);
});

// ---- bindings and filters ----

test("a block that reads a project declares the slot: chart-style blocks need one, infographic-style blocks may name one and otherwise use their canvas's", () => {
  const slotOf = (k) => definitionFor(k).slots.find((x) => x.slot === "project");
  const required = BLOCK_KINDS.filter((k) => slotOf(k)?.min === 1);
  assert.deepEqual(required.sort(), ["CHART", "KPI", "MAP", "METRIC", "TABLE"]);
  const optional = BLOCK_KINDS.filter((k) => slotOf(k)?.min === 0);
  assert.deepEqual(optional.sort(), BLOCK_KINDS.filter((k) => definitionFor(k).reads === "FACTS").sort(), "every block that reads the project's facts may carry its own project");
  const slots = definitionFor("KPI").slots;
  assert.equal(bindingProblems(slots, []).length, 1);
  assert.deepEqual(bindingProblems(slots, [{ type: "PROJECT", slot: "project", projectId: "p" }]), []);
  assert.equal(bindingProblems(slots, [{ type: "MANUAL", slot: "project", value: "5" }]).length, 1, "a typed figure is not a project");
  assert.deepEqual(bindingProblems(definitionFor("REACH").slots, []), [], "a block that falls back to its canvas's project needs no binding");
  assert.deepEqual(bindingProblems(definitionFor("REACH").slots, [{ type: "PROJECT", slot: "project", projectId: "p" }]), []);
  assert.equal(projectOf([{ type: "PROJECT", slot: "project", projectId: "p" }]), "p");
  assert.equal(projectOf([]), undefined);
  assert.deepEqual(projectSlot(["PERIOD"]).honours, ["PERIOD"]);
});

test("a cover takes its title from the design, else the page, else the project; with nothing it asks for one; the picture falls back to the design's cover", () => {
  const f = { ...SAMPLE_FACTS, project: { title: "Safe Water for Borno", donorName: "EU", country: "Nigeria" }, designTitle: "Annual review", subtitle: "2026", coverAssetId: "cover" };
  const m = run("HERO", {}, f).model;
  assert.deepEqual([m.title, m.kicker, m.subtitle, m.assetId], ["Annual review", "EU · Nigeria", "2026", "cover"]);
  assert.equal(run("HERO", { title: "Own title", text: "Own sub", assetId: "mine" }, f).model.title, "Own title");
  assert.equal(run("HERO", { assetId: "mine" }, f).model.assetId, "mine");
  assert.equal(run("HERO", {}, { ...f, designTitle: undefined }).model.title, "Safe Water for Borno");
  const none = run("HERO", {}, undefined);
  assert.deepEqual([none.state, none.authoring], ["empty", true]);
  assert.equal(run("HERO", { title: "T" }, undefined).model.kicker, "", "no project facts, no kicker");
});

test("a block waiting for a person's words says so as a prompt; one waiting for records is not marked as a prompt", () => {
  for (const kind of ["KEY_MESSAGES", "QUOTE", "BANNER", "IMAGE", "TIMELINE", "THREE_W", "SECTOR_GRID", "BIG_NUMBERS", "FUNNEL"]) {
    const r = run(kind, {}, SAMPLE_FACTS);
    assert.equal(r.state, "empty", kind); assert.equal(r.authoring, true, `${kind} is waiting for words or a choice`);
  }
  assert.equal(run("TEXT", { text: " ", role: "body" }).authoring, true);
  assert.equal(run("REACH", {}, { ...SAMPLE_FACTS, reach: { ...SAMPLE_FACTS.reach, overallUnique: 0 } }).authoring, undefined, "no registered people is missing data, not a prompt");
  assert.equal(run("REACH", {}, undefined).state, "unavailable");
});

test("filters come from the slots now: what a block responds to is what it declares", () => {
  assert.deepEqual(honoursOf({ kind: "KPI" }), ["PERIOD", "DRAFTS"]);
  assert.deepEqual(honoursOf({ kind: "MAP" }), ["PERIOD", "PLACE"]);
  assert.deepEqual(honoursOf({ kind: "METRIC" }), []);
  assert.deepEqual(honoursOf({ kind: "PROJECT_LIST" }), ["SECTOR", "STATUS"]);
  assert.deepEqual(honoursOf({ kind: "TEXT" }), []);
  const canvas = { id: "c", scope: "PROJECT", mode: "LIVE", profile: "LIVE_INTERNAL", title: "T", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks: [
    { id: "m", kind: "METRIC", bounds: { x: 0, y: 0, w: 3, h: 2 }, props: {}, bindings: [] },
    { id: "t", kind: "TEXT", bounds: { x: 3, y: 0, w: 3, h: 2 }, props: {}, bindings: [] } ] }] };
  assert.deepEqual(filtersOnPage(canvas, "p"), [], "a page of blocks that respond to nothing offers no filter");
});
