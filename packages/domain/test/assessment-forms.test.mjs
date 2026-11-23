import test from "node:test";
import assert from "node:assert/strict";
import {
  validateFormDefinition, validateSubmission, visibleFields, conditionHolds, parseFormFormula, evaluateFormFormula, computeScore, compareVisits, qualityFlags,
  prefillFromLast, checkAssignmentMove, coverageByArea, draftIsExpired, draftNeedsReminder, checkDraftSave, aggregateRecords, recordMappingProblems,
  formColumns, formRows, formDatasetId, formDatasetParts, localizeForm, missingTranslations, buildAssessmentDocument, proposeFormFromText, FORM_KITS, resolvePath,
  recordSheetTemplate, parseRecordSheet, FIELD_TYPE_DEFS, FORM_FIELD_TYPES,
} from "../dist/index.js";

const grid = { key: "offices", label: "Offices", type: "GRID", rows: [{ key: "ms", label: "MS office" }, { key: "hr", label: "HR office" }], columns: [
  { key: "count", label: "Count", type: "NUMBER", min: 0, max: 3, required: true }, { key: "ok", label: "Adequate", type: "YES_NO", allowNotApplicable: true }, { key: "remarks", label: "Remarks", type: "TEXT" },
] };
const repeat = { key: "blocks", label: "Blocks", type: "REPEAT", minRows: 1, maxRows: 3, fields: [
  { key: "name", label: "Block name", type: "TEXT", required: true }, { key: "area", label: "Area", type: "NUMBER", min: 0 },
  { key: "cond", label: "Condition", type: "SELECT", options: [{ value: "good", label: "Good" }, { value: "poor", label: "Poor" }] },
  { key: "why", label: "Why poor", type: "TEXT", requiredWhen: { field: "cond", op: "EQ", value: "poor" } },
] };
const form = { fields: [
  { key: "sec_a", label: "Section A", type: "SECTION" },
  { key: "has_lab", label: "Has a lab", type: "YES_NO", required: true },
  { key: "sec_lab", label: "Lab", type: "SECTION", relevantWhen: { field: "has_lab", op: "EQ", value: "yes" } },
  { key: "lab_beds", label: "Lab benches", type: "NUMBER", min: 0, allowNotApplicable: true },
  { key: "services", label: "Services", type: "MULTI_SELECT", options: [{ value: "opd", label: "OPD" }, { value: "er", label: "ER" }, { value: "ot", label: "OT" }] },
  { key: "sec_b", label: "Section B", type: "SECTION" },
  grid, repeat,
  { key: "beds", label: "Beds", type: "NUMBER", min: 0 }, { key: "funct", label: "Functional beds", type: "NUMBER", min: 0 },
  { key: "area_total", label: "Total area", type: "CALCULATED", formula: "sum(blocks.*.area)", decimals: 1 },
  { key: "sign", label: "Signature", type: "SIGNATURE", signer: "MS" },
], constraints: [{ kind: "LTE", fields: ["funct", "beds"] }] };

test("every field type has a row in the one table", () => {
  for (const t of FORM_FIELD_TYPES) assert.ok(FIELD_TYPE_DEFS[t], t);
});

test("a form with sections, a grid, a repeat, multi-select and a formula is a valid definition", () => {
  assert.deepEqual(validateFormDefinition(form), []);
});

test("definition problems are named: nested repeat, grid in a repeat, bad formula, unknown constraint field, empty grid", () => {
  const msg = (fields, extra = {}) => validateFormDefinition({ fields, ...extra }).map((p) => p.message).join("\n");
  assert.match(msg([{ key: "r", label: "R", type: "REPEAT", fields: [{ key: "x", label: "X", type: "REPEAT", fields: [{ key: "y", label: "Y", type: "TEXT" }] }] }]), /cannot be a repeat|inside another repeat/);
  assert.match(msg([{ key: "g", label: "G", type: "GRID", rows: [], columns: [] }]), /at least one row/);
  assert.match(msg([{ key: "c", label: "C", type: "CALCULATED", formula: "1 +" }]), /ends too soon|not expected/);
  assert.match(msg([{ key: "c", label: "C", type: "CALCULATED", formula: "later * 2" }, { key: "later", label: "L", type: "NUMBER" }]), /earlier field/);
  assert.match(msg([{ key: "a", label: "A", type: "NUMBER" }], { constraints: [{ kind: "LTE", fields: ["a", "zz"] }] }), /not a field/);
  assert.match(msg([{ key: "m", label: "M", type: "MULTI_SELECT", options: [{ value: "x", label: "X" }] }]), /at least two options/);
  assert.match(msg([{ key: "s", label: "S", type: "SIGNATURE" }, { key: "n", label: "N", type: "NUMBER", verify: { evidenceField: "s", evidenceWhen: ["RECORD_CHECKED"] } }]), /file question/);
});

test("limits: 600 fields, 60 sections", () => {
  const many = Array.from({ length: 601 }, (_, i) => ({ key: `f${i}`, label: "F", type: "TEXT" }));
  assert.match(validateFormDefinition({ fields: many })[0].message, /at most 600/);
  const secs = Array.from({ length: 61 }, (_, i) => ({ key: `s${i}`, label: "S", type: "SECTION" }));
  assert.ok(validateFormDefinition({ fields: secs }).some((p) => /at most 60 sections/.test(p.message)));
});

test("sections hide their fields when not asked, and answers to them are ignored", () => {
  assert.deepEqual(visibleFields(form, { has_lab: "no" }).map((f) => f.key).filter((k) => ["sec_lab", "lab_beds", "services", "sec_b"].includes(k)), ["sec_b"]);
  const r = validateSubmission(form, { has_lab: "no", lab_beds: 4, blocks: [{ name: "A" }], offices: { ms: { count: 1 }, hr: { count: 2 } } });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.ignored, ["lab_beds"]);
});

test("a full valid submission: grid, repeat, multi-select, not applicable, calculated, signature", () => {
  const r = validateSubmission(form, {
    has_lab: "yes", lab_beds: { na: true, reason: "no benches" }, services: ["er", "opd", "opd"],
    offices: { ms: { count: "1", ok: "yes" }, hr: { count: 2, ok: { na: true } } },
    blocks: [{ name: "OPD", area: "120.5", cond: "good" }, { name: "IPD", area: 80, cond: "poor", why: "leaks" }, {}],
    beds: 40, funct: 30, area_total: 9999, sign: "abcd1234efgh",
  });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.values.services, ["opd", "er"]);
  assert.deepEqual(r.values.lab_beds, { na: true, reason: "no benches" });
  assert.deepEqual(r.values.offices, { ms: { count: 1, ok: true }, hr: { count: 2, ok: { na: true } } });
  assert.equal(r.values.blocks.length, 2);
  assert.equal(r.values.area_total, 200.5, "a calculated answer is worked out, not taken from the client");
});

test("problems carry a path inside a repeat and a grid", () => {
  const r = validateSubmission(form, { has_lab: "no", blocks: [{ name: "A", cond: "poor" }, { area: 5 }], offices: { ms: { count: 9 }, hr: {} } });
  const by = Object.fromEntries(r.problems.map((p) => [p.field, p.code]));
  assert.equal(by["blocks[0].why"], "REQUIRED");
  assert.equal(by["blocks[1].name"], "REQUIRED");
  assert.equal(by["offices.ms.count"], "MAX");
  assert.equal(by["offices.hr.count"], "REQUIRED");
});

test("rows: a repeat with a minimum needs rows, and a maximum is held", () => {
  assert.ok(validateSubmission(form, { has_lab: "no", offices: { ms: { count: 1 }, hr: { count: 1 } } }).problems.some((p) => p.field === "blocks" && p.code === "REQUIRED"));
  const four = validateSubmission(form, { has_lab: "no", offices: { ms: { count: 1 }, hr: { count: 1 } }, blocks: [1, 2, 3, 4].map((n) => ({ name: `B${n}` })) });
  assert.ok(four.problems.some((p) => p.code === "ROWS_MAX"));
});

test("not applicable is refused where it is not allowed; unknown rows and columns are named", () => {
  const r = validateSubmission(form, { has_lab: "no", beds: { na: true }, offices: { zz: {}, ms: { count: 1, q: 1 }, hr: { count: 1 } }, blocks: [{ name: "A" }] });
  assert.ok(r.problems.some((p) => p.field === "beds" && /not applicable/.test(p.message)));
  assert.ok(r.problems.some((p) => p.field === "offices.zz"));
  assert.ok(r.problems.some((p) => p.field === "offices.ms.q"));
});

test("multi-select refuses an unknown option; a CONTAINS condition reads the list", () => {
  assert.ok(validateSubmission(form, { has_lab: "yes", services: ["nope"] }).problems.some((p) => p.field === "services" && p.code === "OPTION"));
  assert.equal(conditionHolds({ field: "s", op: "CONTAINS", value: "er" }, { s: ["opd", "er"] }), true);
  assert.equal(conditionHolds({ field: "s", op: "CONTAINS", value: "ot" }, { s: ["opd", "er"] }), false);
  assert.equal(conditionHolds({ field: "s", op: "FILLED" }, { s: ["opd"] }), true);
  assert.equal(conditionHolds({ field: "s", op: "EMPTY" }, { s: [] }), true);
});

test("constraints are judged only when asked, and say it in a sentence", () => {
  const base = { has_lab: "no", offices: { ms: { count: 1 }, hr: { count: 1 } }, blocks: [{ name: "A" }] };
  const r = validateSubmission(form, { ...base, beds: 10, funct: 20 });
  assert.equal(r.problems[0].code, "CONSTRAINT");
  assert.match(r.problems[0].message, /Functional beds cannot be more than Beds/);
  assert.deepEqual(validateSubmission(form, { ...base, beds: 10 }).problems, [], "a missing figure is not a violation");
  const sum = { fields: [{ key: "t", label: "Total", type: "NUMBER" }, { key: "a", label: "A", type: "NUMBER" }, { key: "b", label: "B", type: "NUMBER" }], constraints: [{ kind: "SUM_EQUALS", fields: ["t", "a", "b"] }, { kind: "ONE_OF_REQUIRED", fields: ["a", "b"] }] };
  assert.match(validateSubmission(sum, { t: 10, a: 3, b: 4 }).problems[0].message, /add up to Total/);
  assert.deepEqual(validateSubmission(sum, { t: 7, a: 3, b: 4 }).problems, []);
  assert.match(validateSubmission(sum, { t: 7 }).problems[0].message, /at least one of/);
});

test("formulas: precedence, functions, a missing term is missing (never 0), division by zero is missing", () => {
  const run = (text, data) => { const p = parseFormFormula(text); assert.ok(p.ok, text); return evaluateFormFormula(p.expr, (path) => resolvePath(data, path).map((n) => n.value)); };
  assert.equal(run("1 + 2 * 3", {}), 7);
  assert.equal(run("(1 + 2) * 3", {}), 9);
  assert.equal(run("a / b * 100", { a: 1, b: 4 }), 25);
  assert.equal(run("a / b", { a: 1, b: 0 }), null);
  assert.equal(run("a + 1", {}), null);
  assert.equal(run("sum(r.*.x)", { r: [{ x: 1 }, { x: 2 }, {}] }), 3);
  assert.equal(run("avg(r.*.x)", { r: [{ x: 2 }, { x: 4 }] }), 3);
  assert.equal(run("count(r.*.x)", { r: [{ x: 2 }, {}] }), 1);
  assert.equal(run("sum(g.*.n)", { g: { a: { n: 2 }, b: { n: 5 } } }), 7);
  assert.equal(parseFormFormula("a ^ 2").ok, false);
  assert.equal(parseFormFormula("foo(a)").ok, false);
});

const rules = {
  minAnsweredShare: 0.5, illustrative: true,
  bands: [{ min: 80, label: "Ready", tone: "GOOD" }, { min: 50, label: "Partly", tone: "FAIR" }, { min: 0, label: "Not ready", tone: "POOR" }],
  sections: [
    { key: "lab", title: "Lab", items: [{ path: "offices.*.ok", label: "Office adequate", points: { yes: 1, no: 0 } }] },
    { key: "blocks", title: "Buildings", weight: 2, items: [{ path: "blocks.*.cond", label: "Condition", points: { good: 2, poor: 0 } }] },
  ],
};

test("scoring: unanswered is not 0, not applicable leaves the denominator, bands wait for enough answers", () => {
  const a = { offices: { ms: { ok: true }, hr: { ok: { na: true } } }, blocks: [{ cond: "good" }, { cond: "poor" }] };
  const s = computeScore(rules, a);
  assert.equal(s.sections[0].percent, 100);
  assert.equal(s.sections[0].notApplicable, 1);
  assert.equal(s.sections[1].percent, 50);
  assert.equal(s.overall, Math.round(((100 * 1 + 50 * 2) / 3) * 10) / 10);
  assert.equal(s.band.label, "Partly");
  assert.equal(s.illustrative, true);
  assert.equal(s.lowest[0].label, "Condition");
  const none = computeScore(rules, {});
  assert.equal(none.overall, null);
  assert.equal(none.bandWithheld, "NOTHING_ANSWERED");
  const thin = computeScore({ ...rules, minAnsweredShare: 0.9 }, { offices: { ms: { ok: true } } });
  assert.equal(thin.bandWithheld, "NOT_ENOUGH_ANSWERED");
  assert.equal(thin.band, null);
});

test("a scoring section that does not apply is skipped: no items, no weight, and a facility without it is not marked down", () => {
  const r = { ...rules, sections: [{ ...rules.sections[0], relevantWhen: { field: "has_lab", op: "EQ", value: "yes" } }, rules.sections[1]] };
  const a = { has_lab: false, blocks: [{ cond: "good" }] };
  const s = computeScore(r, a);
  assert.equal(s.sections[0].skipped, true);
  assert.equal(s.sections[0].percent, null);
  assert.equal(s.total, 1, "only the buildings item counts");
  assert.equal(s.overall, 100);
  const withLab = computeScore(r, { has_lab: true, offices: { ms: { ok: true } }, blocks: [{ cond: "good" }] });
  assert.equal(withLab.sections[0].skipped, undefined);
  assert.equal(withLab.total, 2);
  assert.match(validateFormDefinition({ ...form, score: { ...r, sections: [{ ...r.sections[0], relevantWhen: { field: "nope", op: "EQ", value: "yes" } }, r.sections[1]] } }).map((p) => p.message).join("\n"), /names "nope"/);
});

test("a form's score rules are checked with the form", () => {
  const bad = validateFormDefinition({ ...form, score: { bands: [], sections: [{ key: "x", title: "X", items: [{ path: "nope.a", points: { a: 1 } }] }] } });
  const text = bad.map((p) => p.message).join("\n");
  assert.match(text, /not in the form/);
  assert.match(text, /at least two answers/);
  assert.match(text, /at least one band/);
});

test("visit comparison: improved, same, worse and not comparable; section and overall change", () => {
  const before = { offices: { ms: { ok: false }, hr: { ok: true } }, blocks: [{ cond: "poor" }] };
  const after = { offices: { ms: { ok: true }, hr: { ok: true } }, blocks: [{ cond: "poor" }, { cond: "good" }] };
  const c = compareVisits(rules, before, after);
  assert.equal(c.counts.IMPROVED, 1);
  assert.equal(c.counts.SAME, 2);
  assert.equal(c.counts.NOT_COMPARABLE, 1);
  assert.ok(c.overall.delta > 0);
  const worse = compareVisits(rules, after, before);
  assert.equal(worse.counts.WORSE, 1);
});

test("quality flags: too fast, far from the pin, duplicate, few answers; missing facts say nothing", () => {
  const t = new Date("2026-11-20T10:00:00Z");
  const f = qualityFlags({ startedAt: new Date(t.getTime() - 60_000), submittedAt: t, answered: 100, asked: 120, gps: { lat: 34.0, lon: 71.5 }, facilityPin: { lat: 34.2, lon: 71.5 }, sameFacilityInPeriod: true });
  assert.deepEqual(f.map((x) => x.code).sort(), ["DUPLICATE_VISIT", "FAR_FROM_FACILITY", "TOO_FAST"]);
  assert.deepEqual(qualityFlags({ submittedAt: t, answered: 50, asked: 60, sameFacilityInPeriod: false }), []);
  assert.deepEqual(qualityFlags({ submittedAt: t, answered: 1, asked: 100, sameFacilityInPeriod: false }).map((x) => x.code), ["FEW_ANSWERS"]);
});

test("prefill carries only marked facts into empty answers", () => {
  const f = { fields: [{ key: "year", label: "Year", type: "NUMBER", carryForward: true }, { key: "beds", label: "Beds", type: "NUMBER" }, { key: "pop", label: "Pop", type: "NUMBER", carryForward: true }] };
  const p = prefillFromLast(f, { year: 1990, beds: 30, pop: 500 }, { pop: 600 });
  assert.deepEqual(p, { values: { year: 1990 }, carried: ["year"] });
});

test("assignment moves, coverage and drafts", () => {
  assert.equal(checkAssignmentMove("TO_DO", "NOT_VISITED").refusal, "REASON_NEEDED");
  assert.equal(checkAssignmentMove("TO_DO", "NOT_VISITED", "road closed").ok, true);
  assert.equal(checkAssignmentMove("DONE", "TO_DO").refusal, "NOT_ALLOWED");
  const cov = coverageByArea([{ placeId: "a", status: "DONE" }, { placeId: "b", status: "TO_DO" }, { placeId: "c", status: "NOT_VISITED" }], (id) => (id === "c" ? undefined : "d1"));
  assert.deepEqual(cov.map((r) => [r.areaId, r.assigned, r.done]), [["", 1, 0], ["d1", 2, 1]]);
  const saved = new Date("2026-09-01T00:00:00Z");
  assert.equal(draftIsExpired(saved, new Date("2026-11-01T00:00:00Z")), true);
  assert.equal(draftNeedsReminder(saved, new Date("2026-10-27T00:00:00Z")), true);
  assert.equal(draftNeedsReminder(saved, new Date("2026-09-10T00:00:00Z")), false);
  assert.equal(checkDraftSave({ updatedAt: saved }, "other", 10).refusal, "CONFLICT");
  assert.equal(checkDraftSave(undefined, undefined, 3_000_000).refusal, "TOO_BIG");
  assert.equal(checkDraftSave({ updatedAt: saved }, saved.toISOString(), 10).ok, true);
});

test("record totals: count where, percent where, average score, and one current record per facility", () => {
  const periods = [{ id: "p1", start: "2026-10-01", end: "2026-10-31" }];
  const recs = [
    { id: "r1", submittedOn: "2026-10-02", answers: { ok: "yes" }, placeId: "f1", score: 40 },
    { id: "r2", submittedOn: "2026-10-20", answers: { ok: "no" }, placeId: "f1", score: 80 },
    { id: "r3", submittedOn: "2026-10-10", answers: { ok: "yes" }, placeId: "f2", score: 60 },
  ];
  const where = { field: "ok", op: "EQ", value: "yes" };
  const val = (m) => aggregateRecords(recs, m, periods).periods[0].value;
  assert.equal(val({ indicatorId: "i", method: "COUNT_WHERE", where }), "2");
  assert.equal(val({ indicatorId: "i", method: "PERCENT_WHERE", where }), "66.7");
  assert.equal(val({ indicatorId: "i", method: "AVERAGE_SCORE" }), "60");
  const latest = aggregateRecords(recs, { indicatorId: "i", method: "COUNT", latestPerFacility: true }, periods);
  assert.equal(latest.periods[0].value, "2");
  assert.deepEqual(latest.duplicates, ["r1"]);
  assert.deepEqual(recordMappingProblems({ indicatorId: "i", method: "COUNT_WHERE" }, [{ key: "ok", type: "YES_NO" }]), ["Say which records count."]);
  assert.equal(val({ indicatorId: "i", method: "AVERAGE_SCORE" }), "60");
});

test("datasets: a grid, a multi-select and a score become columns; a repeat becomes its own dataset", () => {
  const f = { ...form, score: rules };
  const cols = formColumns(f).map((c) => c.key);
  assert.ok(cols.includes("score_percent") && cols.includes("offices__ms__count") && cols.includes("services__er") && cols.includes("beds"));
  assert.ok(!cols.includes("offices__ms__remarks"), "free text is left out");
  const rec = { id: "r1", submittedOn: "2026-10-02", placeId: "f1", score: { overall: 71.2, band: "Partly" }, answers: { offices: { ms: { count: 2, ok: { na: true } } }, services: ["er"], blocks: [{ name: "A", area: 5, cond: "good" }, { name: "B", area: 7 }], beds: 12 } };
  const [row] = formRows([rec], formColumns(f));
  assert.equal(row.values.offices__ms__count, 2);
  assert.equal(row.values.offices__ms__ok, null, "not applicable is no figure, never 0");
  assert.equal(row.values.services__er, true);
  assert.equal(row.values.services__opd, false);
  assert.equal(row.values.score_percent, 71.2);
  assert.equal(row.placeId, "f1");
  const child = formRows([rec], formColumns(f, "blocks"), "blocks");
  assert.equal(child.length, 2);
  assert.equal(child[1].values.area, 7);
  assert.equal(formDatasetParts(formDatasetId("abc", "blocks")).repeatKey, "blocks");
  assert.equal(formDatasetParts(formDatasetId("abc")).formId, "abc");
});

test("a sheet takes only what fits a cell, and a multi-select cell lists labels", () => {
  const tpl = recordSheetTemplate(form).split("\n")[0];
  assert.ok(tpl.includes("Has a lab") && tpl.includes("Services") && !tpl.includes("Blocks") && !tpl.includes("Signature"));
  const sheet = recordSheetTemplate(form).split("\n")[0] + "\nyes,4,OPD; ER,,,12,10\n";
  const parsed = parseRecordSheet({ fields: form.fields.filter((f) => !["REPEAT", "GRID"].includes(f.type)), constraints: [] }, sheet);
  assert.equal(parsed.rows[0].answers.services.join(","), "opd,er");
});

test("translations: labels by language fall back to the default; missing wording is listed", () => {
  const f = { fields: [{ key: "a", label: "Beds", type: "NUMBER", labels: { ur: "بستر" }, help: "Count", helpLabels: { ur: "گنیں" } }, { key: "b", label: "Water", type: "YES_NO" }] };
  const ur = localizeForm(f, "ur");
  assert.equal(ur.fields[0].label, "بستر");
  assert.equal(ur.fields[0].help, "گنیں");
  assert.equal(ur.fields[1].label, "Water");
  assert.deepEqual(missingTranslations(f, "ur"), ["b"]);
});

test("a finished assessment reads as a document, with words for every answer", () => {
  const doc = buildAssessmentDocument(form, "Facility", { has_lab: true, services: ["er"], offices: { ms: { count: 1, ok: false } }, blocks: [{ name: "A", area: 5 }], sign: "abcd1234" }, { has_lab: "observed" }, computeScore(rules, {}), { facility: "BHU 1" });
  const all = JSON.stringify(doc);
  assert.match(all, /Not answered/);
  assert.match(all, /"Yes"/);
  assert.match(all, /ER/);
  assert.equal(doc.signatures[0].signed, true);
  // A question that was not asked is not listed as unanswered (a section the facility does not have is left out).
  const gated = buildAssessmentDocument({ fields: [{ key: "has_lab", label: "Lab?", type: "YES_NO" }, { key: "sec_lab", label: "Lab", type: "SECTION", relevantWhen: { field: "has_lab", op: "EQ", value: "yes" } }, { key: "benches", label: "Benches", type: "NUMBER" }] }, "T", { has_lab: false });
  assert.deepEqual(gated.sections.map((s) => s.title), ["General"]);
  assert.ok(!JSON.stringify(gated).includes("Benches"));
  assert.equal(doc.facility, "BHU 1");
});

test("the document reader proposes sections, questions and a table, and lists what it could not read", () => {
  const text = [
    "SECTION 04: ACCIDENT AND EMERGENCY", "SECTION 04: ACCIDENT AND EMERGENCY",
    "Registered with the Commission | Yes | No", "Road | Asphalt | PCC | Kachha", "Catchment population | Number: ________",
    "Sr # | INDICATOR | FUNCTIONAL | NON-FUNCTIONAL | REMARKS", "Triage area | | | |", "Waiting area | | | |", "Isolation room | | | |",
    "A line that means nothing",
  ].join("\n");
  const p = proposeFormFromText(text);
  const types = p.fields.map((f) => f.field.type);
  assert.deepEqual(types.filter((t) => t === "SECTION").length, 1);
  assert.ok(types.includes("YES_NO") && types.includes("SELECT") && types.includes("NUMBER") && types.includes("GRID"));
  assert.ok(p.fields.every((f) => f.quote.length > 0));
  assert.deepEqual(validateFormDefinition({ fields: p.fields.map((f) => f.field) }), []);
  assert.ok(p.unread.includes("A line that means nothing"));
});

test("the health facility kit is a valid form, scores, and a filled-in sample submits", () => {
  const kit = FORM_KITS.find((k) => k.id === "health-facility-assessment");
  const def = kit.build();
  assert.deepEqual(validateFormDefinition(def), []);
  assert.ok(def.fields.length < 600 && def.fields.filter((f) => f.type === "SECTION").length < 60);
  const sample = {
    assessed_on: "2026-11-20", ms_name: "Dr A", facility_level: "secondary", facility_type: "category_b", has_admin: "yes", has_ae: "no", has_lab: "no", has_imaging: "no", has_medical: "no", has_surgical: "no", has_gynae: "no", has_paeds: "no",
    has_opd: "no", has_labour: "no", has_ot: "no", has_icu: "no", has_dental: "no", sanctioned_beds: 100, functional_beds: 80, budget_allocation: 1000, budget_utilised: 500,
    admin_infra: { office_for_ms: { available: true } }, blocks: [{ name: "Main", condition: "good" }],
  };
  const r = validateSubmission(def, sample);
  assert.deepEqual(r.problems.filter((p) => p.code !== "REQUIRED"), []);
  assert.equal(r.values.budget_use_pct, 50);
  const s = computeScore(def.score, r.values);
  assert.ok(s.overall !== null && s.illustrative);
});
