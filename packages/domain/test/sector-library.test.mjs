import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_CONTENT, BUILT_IN_INDICATORS, LIBRARY_SECTOR_IDS, LIBRARY_SOURCE_IDS, PACK_PART_KEYS, SECTOR_REGISTRY, SOURCE_REGISTRY, KIND_RULES,
  entryProblems, libraryCoverage, findSector, sectorsForProjectSector, searchLibrary, groupEntries, recommendedSet, referenceVerdict, describeStandard,
  indicatorFieldsOf, linkOf, semanticsOf, projectCodeFor, parseLink, diffVersions, libraryIndicator, packOf, effectiveReview, reviewSheetRows, parseReviewSheet,
  REVIEW_SHEET_HEADER, LIBRARY_DASHBOARD_TEMPLATES, LIBRARY_CANVAS_TEMPLATES, SECTOR_TEMPLATES, BUILT_IN_CANVAS_TEMPLATES, templateProblems, canvasTemplateProblems,
  headlineIndicators, DIRECTION_WORDS,
} from "../dist/index.js";

test("every sector has a registry row, a source row and content", () => {
  for (const id of LIBRARY_SECTOR_IDS) {
    assert.ok(SECTOR_REGISTRY[id], `${id} registry`);
    assert.equal(BUILT_IN_CONTENT[id].sectorId, id);
  }
  for (const id of LIBRARY_SOURCE_IDS) assert.ok(SOURCE_REGISTRY[id], `${id} source`);
  assert.equal(Object.keys(SECTOR_REGISTRY).length, LIBRARY_SECTOR_IDS.length);
});

test("every entry passes the one check and ids are unique", () => {
  const seen = new Set();
  for (const e of BUILT_IN_INDICATORS) {
    assert.deepEqual(entryProblems(e), [], e.id);
    assert.ok(!seen.has(e.id), `duplicate ${e.id}`);
    seen.add(e.id);
  }
  assert.ok(BUILT_IN_INDICATORS.length >= 250, `only ${BUILT_IN_INDICATORS.length} indicators`);
});

test("the coverage report has no unexplained gap", () => {
  const { sectors, problems } = libraryCoverage(BUILT_IN_CONTENT);
  assert.deepEqual(problems, []);
  assert.equal(sectors.length, LIBRARY_SECTOR_IDS.length);
  for (const s of sectors) for (const k of PACK_PART_KEYS) assert.ok(s.parts[k].items > 0 || s.parts[k].because, `${s.sectorId}.${k}`);
});

test("all content starts unreviewed and a reviewed entry must say who and when", () => {
  assert.ok(BUILT_IN_INDICATORS.every((e) => e.review.status === "UNREVIEWED"));
  const e = { ...BUILT_IN_INDICATORS[0], review: { status: "REVIEWED" } };
  assert.ok(entryProblems(e).some((p) => p.code === "REVIEW_WHO"));
});

test("a rate is never summed and a count may be", () => {
  for (const e of BUILT_IN_INDICATORS) {
    if (e.kind === "RATE") assert.notEqual(e.aggregation, "SUM", e.id);
    if (e.kind === "RATIO" || e.kind === "INDEX") assert.notEqual(e.aggregation, "SUM", e.id);
  }
  assert.equal(KIND_RULES.RATE.additive, false);
  assert.equal(KIND_RULES.COUNT.additive, true);
  const bad = { ...libraryIndicator("WASH-H-02"), aggregation: "SUM" };
  assert.ok(entryProblems(bad).some((p) => p.code === "AGGREGATION"));
});

test("a reference standard fits the direction of its indicator", () => {
  const e = { ...libraryIndicator("WASH-S-01"), direction: "HIGHER" };
  assert.ok(entryProblems(e).some((p) => p.code === "REFERENCE_DIRECTION"));
  const only = BUILT_IN_INDICATORS.filter((x) => x.referenceStandard);
  assert.ok(only.length >= 10);
});

test("only the three figures confirmed by search are marked verified", () => {
  const verified = BUILT_IN_INDICATORS.filter((e) => e.referenceStandard?.verified).map((e) => e.id).sort();
  assert.deepEqual(verified, ["WASH-S-01", "WASH-W-01", "WASH-W-02"]);
});

test("sector words find their row and never guess between two", () => {
  assert.equal(findSector("WASH").id, "WASH");
  assert.equal(findSector("water").id, "WASH");
  assert.equal(findSector("Gender-based violence").id, "GBV");
  assert.equal(findSector("nothing like it"), null);
  assert.equal(findSector(""), null);
  assert.ok(sectorsForProjectSector("SHELTER").map((s) => s.id).includes("CCCM"));
  assert.equal(findSector("SHELTER").id, "SHELTER_NFI");
});

test("a library sector maps to a sector a project may store", () => {
  const stored = ["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"];
  for (const d of Object.values(SECTOR_REGISTRY)) assert.ok(stored.includes(d.projectSector), d.id);
});

test("search needs every word, hides what is already in the project, and groups by standard", () => {
  const all = BUILT_IN_INDICATORS;
  const water = searchLibrary(all, { text: "water litres person" });
  assert.ok(water.some((e) => e.id === "WASH-W-01"));
  assert.ok(searchLibrary(all, { text: "water litres person", exclude: new Set(["WASH-W-01"]) }).every((e) => e.id !== "WASH-W-01"));
  assert.equal(searchLibrary(all, { text: "zzzz-no-match" }).length, 0);
  const wash = searchLibrary(all, { sectors: ["WASH"] });
  assert.ok(wash.length >= 20);
  assert.ok(groupEntries(wash).length >= 5);
  assert.ok(searchLibrary(all, { sectors: ["HEALTH"] }).some((e) => e.id === "WASH-I-01"), "also-in sectors list the entry");
  assert.ok(recommendedSet(all, ["NUTRITION"]).every((e) => e.recommended));
  assert.equal(searchLibrary(all, { sectors: ["WASH"], reviewed: "REVIEWED_ONLY" }).length, 0);
});

test("reference verdict judges a recorded number only", () => {
  const std = libraryIndicator("WASH-W-01").referenceStandard;
  assert.equal(referenceVerdict(std, "15", "l/p/d").state, "MEETS");
  assert.equal(referenceVerdict(std, 14.9, "l/p/d").state, "BELOW");
  assert.deepEqual(referenceVerdict(std, "", "l/p/d"), { state: "NOT_JUDGED", reason: "NO_VALUE" });
  assert.deepEqual(referenceVerdict(std, null), { state: "NOT_JUDGED", reason: "NO_VALUE" });
  assert.deepEqual(referenceVerdict(std, "n/a"), { state: "NOT_JUDGED", reason: "NOT_NUMBER" });
  assert.deepEqual(referenceVerdict(std, 20, "litres"), { state: "NOT_JUDGED", reason: "UNIT_DIFFERS" });
  assert.deepEqual(referenceVerdict(undefined, 20), { state: "NOT_JUDGED", reason: "NO_STANDARD" });
  const max = libraryIndicator("WASH-S-01").referenceStandard;
  assert.equal(referenceVerdict(max, 20).state, "MEETS");
  assert.equal(referenceVerdict(max, 21).state, "ABOVE");
  const range = libraryIndicator("HLT-R-04").referenceStandard;
  assert.equal(referenceVerdict(range, 4).state, "BELOW");
  assert.equal(referenceVerdict(range, 10).state, "MEETS");
  assert.equal(referenceVerdict(range, 16).state, "ABOVE");
  assert.equal(describeStandard(std), "at least 15 l/p/d");
  assert.equal(describeStandard(range), "5 to 15 %");
});

test("an adopted entry becomes an indicator the project owns, with a link to compare later", () => {
  const e = libraryIndicator("WASH-W-01");
  const f = indicatorFieldsOf(e);
  assert.equal(f.type, "RATIO");
  assert.equal(f.semantics.direction, "HIGHER_IS_BETTER");
  assert.equal(f.semantics.status, "REQUIRES_REVIEW");
  assert.equal(semanticsOf({ ...e, review: { status: "REVIEWED", reviewer: "A", reviewedOn: "2026-11-08" } }).status, "INFERRED");
  assert.equal(indicatorFieldsOf(libraryIndicator("WASH-S-02")).type, "NUMBER");
  assert.equal(indicatorFieldsOf(libraryIndicator("WASH-H-02")).type, "PERCENTAGE");
  assert.equal(projectCodeFor(e, new Set()), "WASH-W-01");
  assert.equal(projectCodeFor(e, new Set(["WASH-W-01"])), "WASH-W-01-2");
  const link = linkOf(e, "2026-11-08");
  assert.deepEqual(parseLink(JSON.stringify(link)), link);
  assert.equal(parseLink("not json"), null);
  assert.equal(parseLink(null), null);
  assert.equal(DIRECTION_WORDS.HIGHER, "higher is better");
});

test("a later version is shown as a difference, never applied", () => {
  const e = libraryIndicator("WASH-W-01");
  const link = linkOf(e, "2026-11-08");
  const lookup = (id) => (id === e.id ? e : undefined);
  assert.deepEqual(diffVersions(link, e, lookup), { state: "CURRENT" });
  const next = { ...e, version: 2, unit: "litres", referenceStandard: { ...e.referenceStandard, value: 20 } };
  const d = diffVersions(link, next, () => next);
  assert.equal(d.state, "CHANGED");
  assert.deepEqual(d.changes.map((c) => c.field).sort(), ["referenceStandard", "unit"]);
  assert.equal(diffVersions(link, undefined, () => undefined).state, "REMOVED");
  const old = { ...e, version: 2, review: { status: "DEPRECATED" }, deprecatedBy: "WASH-W-99" };
  assert.deepEqual(diffVersions(link, old, (id) => (id === "WASH-W-99" ? e : undefined)), { state: "REPLACED", replacedBy: "WASH-W-99" });
});

test("review: a decision counts for its own version only; a sheet goes out and comes back", () => {
  const e = libraryIndicator("WASH-W-01");
  const dec = { entryId: e.id, version: 1, status: "REVIEWED", reviewer: "Ada", reviewedOn: "2026-11-08" };
  assert.equal(effectiveReview(e, dec).status, "REVIEWED");
  assert.equal(effectiveReview({ ...e, version: 2 }, dec).status, "UNREVIEWED");
  const rows = reviewSheetRows([e], new Map(), (x) => describeStandard(x.referenceStandard));
  assert.equal(rows[0].length, REVIEW_SHEET_HEADER.length);
  const known = new Map(BUILT_IN_INDICATORS.map((x) => [x.id, x]));
  rows[0][11] = "REVIEWED";
  rows[0][12] = "Ada";
  const ok = parseReviewSheet(rows, known, "Ada", "2026-11-08");
  assert.equal(ok.ok, true);
  assert.equal(ok.decisions[0].status, "REVIEWED");
  const bad = parseReviewSheet([["NOPE-1", "1", ...Array(9).fill(""), "REVIEWED", "", ""]], known, "Ada", "2026-11-08");
  assert.equal(bad.ok, false);
  assert.match(bad.problems[0].message, /not an indicator/);
  const stale = parseReviewSheet([[e.id, "9", ...Array(9).fill(""), "REVIEWED", "Ada", ""]], known, "Ada", "2026-11-08");
  assert.equal(stale.ok, false);
  const wrongStatus = parseReviewSheet([[e.id, "1", ...Array(9).fill(""), "DEPRECATED", "Ada", ""]], known, "Ada", "2026-11-08");
  assert.equal(wrongStatus.ok, false);
});

test("the pack of any sector answers every part, with a reason when empty", () => {
  for (const id of LIBRARY_SECTOR_IDS) {
    const parts = packOf(BUILT_IN_CONTENT[id]);
    assert.deepEqual(parts.map((p) => p.key), [...PACK_PART_KEYS]);
    for (const p of parts) assert.ok(p.items.length > 0 || p.because, `${id}.${p.key}`);
  }
  const wash = packOf(BUILT_IN_CONTENT.WASH);
  assert.ok(wash.find((p) => p.key === "assessment").items.length > 7, "common questions are merged in");
  assert.ok(wash.find((p) => p.key === "checklist").items.some((i) => i.key === "do-no-harm"));
});

test("dashboards and canvases built from the library are valid and cover sectors the hand-written ones do not", () => {
  assert.ok(LIBRARY_DASHBOARD_TEMPLATES.length >= 15, `only ${LIBRARY_DASHBOARD_TEMPLATES.length}`);
  for (const t of LIBRARY_DASHBOARD_TEMPLATES) assert.deepEqual(templateProblems(t), [], t.id);
  for (const t of LIBRARY_CANVAS_TEMPLATES) assert.deepEqual(canvasTemplateProblems(t), [], t.id);
  assert.ok(SECTOR_TEMPLATES.some((t) => t.id === "tpl-lib-shelter-nfi"));
  assert.ok(SECTOR_TEMPLATES.some((t) => t.id === "tpl-wash-access-hygiene"));
  assert.ok(BUILT_IN_CANVAS_TEMPLATES.some((t) => t.id === "lib-canvas-wash"));
  assert.ok(BUILT_IN_CANVAS_TEMPLATES.some((t) => t.id === "builtin-flash-update"));
  assert.equal(new Set(SECTOR_TEMPLATES.map((t) => t.id)).size, SECTOR_TEMPLATES.length);
  assert.ok(headlineIndicators(BUILT_IN_CONTENT.WASH).length >= 4);
});

test("a hand-written dashboard template named by a sector exists", () => {
  const ids = new Set(SECTOR_TEMPLATES.map((t) => t.id));
  for (const id of LIBRARY_SECTOR_IDS) for (const t of BUILT_IN_CONTENT[id].dashboardTemplates) assert.ok(ids.has(t), `${id} names ${t}`);
});
