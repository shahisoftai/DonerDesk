import test from "node:test";
import assert from "node:assert/strict";
import {
  applySteps, detectHeaderRow, guessColumns, typeRows, runChecks, columnProblems, datasetToSource, datasetRowsToVisual, toStoredRows,
  planRefresh, problemsSheet, completeness, rankDrivers, linkedValues, linkWriteFor, linkProblems, detectPersonalData, readMonth, readNumber, readDay,
  KITS, validateKit, matchKit, applyKit, buildPages, kitChecks, NUTRITION_KIT, WASH_KIT, STEP_DEFS, CHECK_DEFS, COLUMN_KINDS, SEMANTICS,
  catalogueWith, validateVisualQuery, shapeTable, wellsToQuery, wellRefusal, switchFamily, suggestFamily, isoWeekStart, dhisPeriod, datasetConnectorDef,
  canSeeDataset, canManageDataset, restrictionProblems, BLOCK_FIXTURES, definitionFor,
} from "../dist/index.js";
import { wide, county, monthsAsColumns } from "./fixtures/datasets/generate.mjs";

const confirm = (wb, steps = []) => {
  const out = applySteps(wb, steps);
  const proposals = guessColumns(out.table);
  return { table: out.table, columns: proposals.map((p) => p.column), proposals };
};

test("cells: a gap is null, an unreadable cell undefined, ambiguous days refused", () => {
  assert.equal(readNumber(""), null);
  assert.equal(readNumber("1,234"), 1234);
  assert.equal(readNumber("1,5"), undefined);
  assert.equal(readNumber("n/a"), null);
  assert.equal(readMonth("May-22"), "2022-05");
  assert.equal(readMonth("Mya"), undefined);
  assert.equal(readDay("03/04/2026"), undefined);
  assert.equal(readDay("13/04/2026"), "2026-04-13");
});

test("header row detected below a title row; guesses cover a wide export", () => {
  const wb = wide();
  assert.equal(detectHeaderRow(wb.sheets[0].cells), 3);
  const { columns } = confirm(wb);
  const by = (h) => columns.find((c) => c.sourceHeader === h);
  assert.equal(by("District").semantic, "PLACE");
  assert.equal(by("Month").kind, "MONTH");
  assert.equal(by("Month").semantic, "PERIOD");
  assert.equal(by("Partner").semantic, "PARTNER");
  assert.equal(by("Donor").semantic, "DONOR");
  assert.equal(by("TotalChildScreen").kind, "COUNT");
  assert.ok(by("Partner").hideOnShareLinks, "partner names never go through a link");
  assert.deepEqual(columnProblems(columns), []);
  const right = columns.filter((c) => (c.semantic !== "NONE" || c.kind === "COUNT")).length;
  assert.ok(right / columns.length >= 0.9, `guess accuracy ${right}/${columns.length}`);
});

test("tidy steps: unpivot months as columns, then replay is idempotent", () => {
  const steps = [{ id: "s1", type: "UNPIVOT", params: { columns: ["January", "February", "March"], nameColumn: "Month", valueColumn: "Value" } }];
  const a = applySteps(monthsAsColumns(), steps);
  assert.equal(a.problem, undefined);
  assert.deepEqual(a.table.headers, ["District", "Indicator", "Month", "Value"]);
  assert.equal(a.table.rows.length, 6);
  assert.deepEqual(applySteps(monthsAsColumns(), steps).table, a.table);
  const bad = applySteps(monthsAsColumns(), [{ id: "x", type: "RENAME", params: { from: "Nope", to: "Y" } }]);
  assert.match(bad.problem.message, /no column called 'Nope'/);
});

test("every step and check is a row with a sentence", () => {
  for (const s of STEP_DEFS) assert.equal(typeof s.describe({}), "string");
  for (const c of CHECK_DEFS) assert.doesNotThrow(() => c.validate({}, []));
  assert.ok(COLUMN_KINDS.every((k) => k.noun && k.example));
  assert.ok(SEMANTICS.every((s) => s.kinds.length > 0));
});

test("checks name the row: duplicates block, outcomes that do not add up warn", () => {
  const { table, columns } = confirm(wide());
  table.rows.push([...table.rows[0]]);
  table.rows[1][12] = 999; // TotalExitOTP
  const { rows, unreadable } = typeRows(table, columns, 4);
  const key = (h) => columns.find((c) => c.sourceHeader === h).key;
  const findings = runChecks({ rows, columns, unreadable }, [{ id: "x", check: "SUM_EQUALS", label: "OTP outcomes add up to exits", params: { total: key("TotalExitOTP"), parts: ["DisCuredOTP", "DisDeathOTP", "DisDefaultOTP", "DisNonResponseOTP", "DisTransferOTP"].map(key) } }]);
  const dup = findings.find((f) => f.check === "KEY_UNIQUE");
  assert.equal(dup.severity, "BLOCK");
  assert.match(dup.message, /Rows 4, \d+ are all/);
  const sum = findings.find((f) => f.check === "SUM_EQUALS");
  assert.match(sum.message, /Row 5: .*999/);
  const sheet = problemsSheet(table, findings, 4);
  assert.equal(sheet.headers.at(-1), "Problems");
  assert.ok(sheet.rows.every((r) => r.at(-1)));
});

test("a rate by province is a ratio of sums, never an average of district rates", () => {
  const { table, columns } = confirm(wide());
  const { rows } = typeRows(table, columns, 4);
  const stored = toStoredRows(rows, columns, new Map());
  const source = datasetToSource({ id: "d1", name: "National", description: "", scope: "ORGANISATION", restricted: false }, columns);
  const cat = catalogueWith([source]);
  const key = (h) => columns.find((c) => c.sourceHeader === h).key;
  const q = wellsToQuery("BAR", { AXIS: [{ ref: key("Province") }] }, source.id, { calculated: [{ id: "cure", label: "Cure rate", op: "SHARE", terms: [key("DisCuredOTP"), key("TotalExitOTP")], percent: true }] }, cat);
  q.measures = [key("DisCuredOTP"), key("TotalExitOTP")];
  assert.deepEqual(validateVisualQuery(q, cat), []);
  const t = shapeTable(datasetRowsToVisual(stored), q, [], cat);
  for (const r of t.rows) {
    const mine = stored.filter((s) => s.values[key("Province")] === r[key("Province")]);
    const cured = mine.reduce((a, s) => a + s.values[key("DisCuredOTP")], 0), exits = mine.reduce((a, s) => a + s.values[key("TotalExitOTP")], 0);
    assert.equal(r.cure, Math.round((cured / exits) * 100 * 1e6) / 1e6);
  }
  const rate = { ...columns[0], key: "rate", label: "Cure rate", sourceHeader: "Cure rate", kind: "RATE", semantic: "NONE" };
  const s2 = datasetToSource({ id: "d2", name: "x", description: "", scope: "PROJECT", restricted: false }, [...columns, rate]);
  const c2 = catalogueWith([s2]);
  const avg = validateVisualQuery({ source: s2.id, measures: ["rate"], groupBy: [key("Province")], aggregate: { rate: "AVERAGE" }, includeDraft: true }, c2);
  assert.equal(avg[0].code, "AVERAGE_OF_RATE");
  const sum = validateVisualQuery({ source: s2.id, measures: ["rate"], groupBy: [], aggregate: { rate: "SUM" }, includeDraft: true }, c2);
  assert.equal(sum[0].code, "RATE_SUMMED");
  assert.equal(wellRefusal("STACKED_BAR", "VALUES", "rate", s2.id, c2), "Cure rate is a rate; it cannot be stacked or sliced into parts of a whole.");
});

test("count distinct counts different values; wells switch and suggest", () => {
  const { table, columns } = confirm(wide());
  const stored = toStoredRows(typeRows(table, columns, 4).rows, columns, new Map());
  const source = datasetToSource({ id: "d1", name: "N", description: "", scope: "PROJECT", restricted: false }, columns);
  const cat = catalogueWith([source]);
  const key = (h) => columns.find((c) => c.sourceHeader === h).key;
  const q = wellsToQuery("CARD", { VALUES: [{ ref: key("District"), aggregate: "COUNT_DISTINCT" }] }, source.id, {}, cat);
  assert.deepEqual(validateVisualQuery(q, cat), []);
  assert.equal(shapeTable(datasetRowsToVisual(stored), q, [], cat).rows[0][key("District")], 8);
  const sw = switchFamily("BAR", "PIE", { AXIS: [{ ref: key("Province") }], VALUES: [{ ref: key("SAM") }, { ref: key("MAM") }] }, source.id, cat);
  assert.ok(sw.wells.AXIS);
  assert.equal(suggestFamily({ AXIS: [{ ref: key("Month") }], VALUES: [{ ref: key("SAM") }] }, source.id, cat).family, "LINE");
});

test("personal data is flagged; a restricted dataset is seen only by the people named", () => {
  const found = detectPersonalData(["Beneficiary name", "Phone", "District name", "Children screened", "email"], [["A B"], ["+92 300 1234567", "+92 301 7654321"], ["Alder"], [10], ["a@b.org"]]);
  assert.deepEqual(found.map((f) => f.detector), ["PERSON_NAME", "PHONE", "EMAIL"]);
  const viewer = { userId: "u2", canManageOrg: false, canManage: true, canContribute: true, external: false, isProjectManager: true };
  const restricted = { scope: "PROJECT", restricted: true, createdById: "u1", restriction: { lawfulBasis: "CONSENT", purpose: "Case follow-up list", retainUntil: "2027-01-01", viewerIds: [] } };
  assert.equal(canSeeDataset(restricted, viewer), false);
  assert.equal(canSeeDataset(restricted, { ...viewer, userId: "u1" }), true);
  assert.equal(canManageDataset({ ...restricted, restricted: false }, { ...viewer, external: true }), false);
  assert.ok(restrictionProblems({ lawfulBasis: "X", purpose: "short", retainUntil: "2020-01-01", viewerIds: [] }, "2026-11-14").length === 3);
});

test("kits: every kit passes its contract; the nutrition kit matches a ministry export and builds pages", () => {
  for (const kit of KITS) assert.deepEqual(validateKit(kit), [], kit.key);
  const { columns } = confirm(wide());
  const m = matchKit(columns, NUTRITION_KIT);
  assert.ok(m.mapping.otp_admissions && m.mapping.otp_cured && m.mapping.otp_exits && m.mapping.district && m.mapping.month, JSON.stringify(m.mapping));
  const applied = applyKit(columns, NUTRITION_KIT, m.mapping);
  assert.equal(applied.find((c) => c.key === m.mapping.month).semantic, "PERIOD");
  const built = buildPages(NUTRITION_KIT, m.mapping, "dataset:d1");
  assert.ok(built.pages.length >= 5, `pages ${built.pages.map((p) => p.id)}`);
  assert.ok(built.skipped.some((s) => /Supplies|Micronutrients|Infant/.test(s)), built.skipped.join(" | "));
  for (const p of built.pages) for (const b of p.blocks) {
    const def = definitionFor(b.kind);
    assert.ok(def, b.kind);
    assert.deepEqual(def.validate(b.props), [], `${p.id}/${b.id}: ${JSON.stringify(b.props)}`);
  }
  assert.ok(kitChecks(NUTRITION_KIT, m.mapping).some((c) => c.check === "SUM_EQUALS"));
});

test("the WASH kit is data only: it matches, builds and recomputes litres per person as a ratio of sums", () => {
  const wb = { sheets: [{ name: "w", cells: [["District", "Month", "People served", "Litres per day", "Water points", "Water points functional", "Latrines"], ["Alder", "2026-01", 1000, 12000, 10, 9, 40], ["Alder", "2026-02", 1100, 18700, 10, 8, 45], ["Birch", "2026-01", 500, 9000, 4, 4, 20]] }] };
  const { table, columns } = confirm(wb);
  const m = matchKit(columns, WASH_KIT);
  const built = buildPages(WASH_KIT, m.mapping, "dataset:w");
  assert.ok(built.pages.length >= 2);
  const applied = applyKit(columns, WASH_KIT, m.mapping);
  const stored = toStoredRows(typeRows(table, applied, 2).rows, applied, new Map());
  const block = built.pages[0].blocks.find((b) => b.props.calculated?.[0]?.id === "lpppd");
  const source = datasetToSource({ id: "w", name: "WASH", description: "", scope: "PROJECT", restricted: false }, applied);
  const model = definitionFor("DATA_VISUAL").resolve(block.props, { source, rows: datasetRowsToVisual(stored), totalRows: 3, notedRows: 0, filtered: [] });
  assert.equal(model.state, "ready");
  const alder = model.model.table.rows.find((r) => r[m.mapping.district] === "Alder");
  assert.equal(alder.lpppd, Math.round(((12000 + 18700) / 2100) * 1e6) / 1e6);
  assert.equal(model.model.references[0].value, 15);
});

test("refresh adds only new periods and names what changed", () => {
  const cols = [{ key: "d", label: "District", sourceHeader: "District", kind: "TEXT", semantic: "PLACE", hideOnShareLinks: false }, { key: "m", label: "Month", sourceHeader: "Month", kind: "MONTH", semantic: "PERIOD", hideOnShareLinks: false }, { key: "n", label: "N", sourceHeader: "N", kind: "COUNT", semantic: "NONE", hideOnShareLinks: false }];
  const row = (rowNo, d, m, n) => ({ rowNo, values: { d, m, n }, periodKey: m });
  const cur = [row(2, "A", "2026-01", 1), row(3, "B", "2026-01", 2)];
  const add = planRefresh(cur, [row(2, "A", "2026-01", 9), row(3, "A", "2026-02", 5)], cols, "ADD_PERIODS");
  assert.equal(add.rows.length, 3);
  assert.equal(add.diff.added, 1);
  assert.equal(add.diff.skipped, 1);
  const rep = planRefresh(cur, [row(2, "A", "2026-01", 9)], cols, "REPLACE");
  assert.deepEqual([rep.diff.added, rep.diff.changed, rep.diff.removed], [0, 1, 1]);
});

test("completeness counts reports received over units expected", () => {
  const rows = [{ rowNo: 1, values: { u: "A", f: 1 }, periodKey: "2026-01" }, { rowNo: 2, values: { u: "B", f: null }, periodKey: "2026-01" }, { rowNo: 3, values: { u: "B", f: 2 }, periodKey: "2026-02" }];
  const cells = completeness({ rows, unitOf: (r) => r.values.u, groupOfUnit: () => "All", expected: new Map([["All", ["A", "B"]]]), figures: ["f"], periods: ["2026-01", "2026-02"] });
  assert.deepEqual(cells.map((c) => [c.period, c.reported, c.expected, c.share]), [["2026-01", 1, 2, 50], ["2026-02", 1, 2, 50]]);
});

test("drivers rank a known difference, refuse small or constant groups, and never claim a cause", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ outcome: i % 2 === 0 ? 80 + (i % 5) : 65 + (i % 5), attributes: { partner: i % 2 === 0 ? "A" : "B", same: "x", tiny: i < 3 ? "t" : "u" } }));
  const r = rankDrivers(rows, "Cure rate", [{ key: "partner", label: "Partner" }, { key: "same", label: "Same" }, { key: "tiny", label: "Tiny" }]);
  assert.equal(r[0].status, "RANKED");
  assert.equal(r[0].candidate, "partner");
  assert.match(r[0].sentence, /not a cause/);
  assert.ok(!/ (cause|causes|caused) /.test(r[0].sentence.replace("not a cause", "")));
  assert.deepEqual(rankDrivers(rows, "Cure rate", [{ key: "partner", label: "Partner" }]), r.slice(0, 1).concat([]).slice(0, 1));
  assert.ok(r.filter((x) => x.status === "REFUSED").length === 2);
});

test("links: a rate links to a rate through its parts; a verified value is never overwritten", () => {
  const cols = [{ key: "c", label: "Cured", sourceHeader: "c", kind: "COUNT", semantic: "NONE", hideOnShareLinks: false }, { key: "e", label: "Exits", sourceHeader: "e", kind: "COUNT", semantic: "NONE", hideOnShareLinks: false }];
  const figs = [{ id: "cure", label: "Cure", op: "SHARE", terms: ["c", "e"], percent: true }];
  assert.ok(linkProblems({ indicatorId: "i", figureRef: "cure", filters: [], byPlace: false }, { id: "i", type: "NUMBER" }, cols, figs).length > 0);
  assert.deepEqual(linkProblems({ indicatorId: "i", figureRef: "cure", filters: [], byPlace: false }, { id: "i", type: "PERCENTAGE" }, cols, figs), []);
  const rows = [{ rowNo: 1, values: { c: 8, e: 10 }, periodKey: "2026-01", placeId: "p1" }, { rowNo: 2, values: { c: 1, e: 10 }, periodKey: "2026-01", placeId: "p2" }];
  const v = linkedValues({ indicatorId: "i", figureRef: "cure", filters: [], byPlace: true }, rows, cols, figs, [{ id: "q1", startDate: "2026-01-01", endDate: "2026-03-31" }], (id) => id.toUpperCase());
  assert.equal(v[0].value, 45);
  assert.deepEqual(v[0].byPlace, { P1: 80, P2: 10 });
  assert.equal(linkWriteFor(45, { value: 40, status: "VERIFIED" }).action, "NOTE_VERIFIED");
  assert.equal(linkWriteFor(null, undefined).action, "SKIP_EMPTY");
  assert.equal(isoWeekStart("2026-W07"), "2026-02-09");
});

test("DHIS2 connector builds a request and reads an analytics table", () => {
  const d = datasetConnectorDef("DHIS2");
  assert.deepEqual(d.problems({ kind: "DHIS2", serverUrl: "https://play.example.org", dataElements: ["abcdefghijk"], orgUnits: ["LEVEL-3"], periods: "LAST_12_MONTHS", schedule: "MONTHLY" }), []);
  const parsed = d.parse({ headers: [{ name: "dx" }, { name: "ou" }, { name: "pe" }, { name: "value" }], rows: [["SAM admissions", "Alder", "202601", "12"], ["SAM cured", "Alder", "202601", "9"]] });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.value.headers, ["Org unit", "Period", "SAM admissions", "SAM cured"]);
  assert.deepEqual(parsed.value.rows[0], ["Alder", "2026-01", 12, 9]);
  assert.equal(dhisPeriod("2026W7"), "2026-W07");
});

test("dataset blocks resolve their fixtures", () => {
  for (const kind of ["DATA_VISUAL", "DATA_SLICER", "DATA_COMPLETENESS", "DATA_DRIVERS"]) {
    const fx = BLOCK_FIXTURES[kind];
    const m = definitionFor(kind).resolve(fx.props, fx.data);
    assert.equal(m.state, "ready", `${kind}: ${m.reason ?? ""}`);
    assert.equal(definitionFor(kind).resolve(fx.props, undefined).state, "unavailable");
  }
});

test("a monthly export is offered its kit, and the kit's wording replaces raw headers", async () => {
  const { bestKit } = await import("../dist/index.js");
  const { columns } = confirm(wide());
  const best = bestKit((k) => matchKit(columns, k));
  assert.equal(best?.kit.key, "NUTRITION");
  const applied = applyKit(columns, NUTRITION_KIT, best.match.mapping);
  assert.equal(applied.find((c) => c.sourceHeader === "TotalChildScreen").label, "Children screened");
});
