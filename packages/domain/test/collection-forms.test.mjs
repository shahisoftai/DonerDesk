import test from "node:test";
import assert from "node:assert/strict";
import { validateFormDefinition, validateSubmission, visibleFields, conditionHolds, aggregateRecords, recordMappingProblems, recordSheetTemplate, parseRecordSheet } from "../dist/index.js";

const form = {
  fields: [
    { key: "visit_date", label: "Visit date", type: "DATE", required: true },
    { key: "attended", label: "Attended", type: "YES_NO", required: true },
    { key: "reason", label: "Reason absent", type: "TEXT", relevantWhen: { field: "attended", op: "EQ", value: "no" }, requiredWhen: { field: "attended", op: "EQ", value: "no" } },
    { key: "kits", label: "Kits given", type: "NUMBER", min: 0, max: 500, relevantWhen: { field: "attended", op: "EQ", value: "yes" } },
    { key: "site", label: "Site", type: "SELECT", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
    { key: "where", label: "Where", type: "GPS" },
  ],
};

test("a valid form has no problems; the usual mistakes are each named", () => {
  assert.deepEqual(validateFormDefinition(form), []);
  const bad = validateFormDefinition({ fields: [
    { key: "Bad Key", label: "x", type: "TEXT" },
    { key: "a", label: "A", type: "TEXT" }, { key: "a", label: "A2", type: "TEXT" },
    { key: "c", label: "C", type: "SELECT", options: [{ value: "x", label: "X" }] },
    { key: "d", label: "D", type: "TEXT", min: 1 },
    { key: "e", label: "E", type: "NUMBER", min: 5, max: 1, relevantWhen: { field: "later", op: "FILLED" } },
    { key: "later", label: "Later", type: "TEXT" },
    { key: "f", label: "F", type: "TEXT", requiredWhen: { field: "f", op: "FILLED" } },
  ] }).map((p) => p.message).join("\n");
  for (const re of [/not a valid field key/, /used twice/, /at least two options/, /Only a number field/, /smallest allowed value/, /earlier field/, /depend on itself/]) assert.match(bad, re);
  assert.match(validateFormDefinition({ fields: [] })[0].message, /at least one field/);
});

test("fields are shown by their conditions, and answers to hidden fields are ignored, not stored", () => {
  assert.deepEqual(visibleFields(form, { attended: "yes" }).map((f) => f.key), ["visit_date", "attended", "kits", "site", "where"]);
  const r = validateSubmission(form, { visit_date: "2026-10-05", attended: "no", reason: "Ill", kits: 4 });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.ignored, ["kits"]);
  assert.deepEqual(r.values, { visit_date: "2026-10-05", attended: false, reason: "Ill" });
});

test("required, required-when, ranges, dates, choices, GPS and unknown fields", () => {
  const msg = (answers) => validateSubmission(form, answers).problems.map((p) => p.message);
  assert.deepEqual(msg({}), ["Visit date is required.", "Attended is required."]);
  assert.deepEqual(msg({ visit_date: "2026-10-05", attended: "no" }), ["Reason absent is required."]);
  assert.match(msg({ visit_date: "2026-02-30", attended: "yes" })[0], /real date/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "yes", kits: "600" })[0], /above 500/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "yes", kits: "many" })[0], /must be a number/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "yes", site: "z" })[0], /not one of the options/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "yes", where: { lat: 95, lon: 0 } })[0], /latitude/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "maybe" })[0], /Yes or No/);
  assert.match(msg({ visit_date: "2026-10-05", attended: "yes", nope: 1 })[0], /not a field/);
  const ok = validateSubmission(form, { visit_date: "2026-10-05", attended: "yes", kits: "1,200".replace(",", ""), where: { lat: "1.5", lon: 32 } });
  assert.deepEqual(ok.problems.map((p) => p.message), ["Kits given cannot be above 500."]);
  assert.equal(validateSubmission(form, { visit_date: "2026-10-05", attended: "yes", kits: "12", where: { lat: "1.5", lon: 32 } }).values.kits, 12);
});

test("conditions: and/or groups, an unanswered field never satisfies a comparison", () => {
  const a = { n: 5 };
  assert.equal(conditionHolds({ all: [{ field: "n", op: "GTE", value: 5 }, { field: "n", op: "LT", value: 6 }] }, a), true);
  assert.equal(conditionHolds({ any: [{ field: "n", op: "GT", value: 9 }, { field: "m", op: "EMPTY" }] }, a), true);
  assert.equal(conditionHolds({ field: "m", op: "GT", value: 0 }, a), false);
  assert.equal(conditionHolds({ field: "n", op: "IN", value: [4, 5] }, a), true);
});

const periods = [{ id: "p1", start: "2026-10-01", end: "2026-10-31" }, { id: "p2", start: "2026-11-01", end: "2026-11-30" }];
const rec = (id, submittedOn, answers) => ({ id, submittedOn, answers });

test("records are counted or summed into the period of their date; gaps stay empty, not 0", () => {
  const records = [
    rec("r1", "2026-10-03", { kits: 4 }), rec("r2", "2026-10-09", { kits: "6" }), rec("r3", "2026-10-31", {}),
    rec("r4", "2026-12-01", { kits: 9 }), rec("r5", "2026-10-20", { kits: 2, visit_date: "2026-11-02" }),
  ];
  const sum = aggregateRecords(records, { indicatorId: "i", method: "SUM", valueField: "kits", dateField: "visit_date" }, periods);
  assert.deepEqual(sum.periods.map((p) => [p.periodId, p.value]), [["p1", "10"], ["p2", "2"]]);
  assert.deepEqual(sum.missingFigure, ["r3"]);
  assert.deepEqual(sum.outsidePeriods, ["r4"]);
  const count = aggregateRecords([rec("a", "2026-10-03", {}), rec("b", "2026-10-04", {})], { indicatorId: "i", method: "COUNT" }, periods);
  assert.deepEqual(count.periods.map((p) => [p.value, p.recordCount]), [["2", 2], ["", 0]]);
});

test("a repeated submission counts once (the latest); records with no identifying answers never merge", () => {
  const records = [rec("a", "2026-10-03", { name: "Amina", phone: "1" }), rec("b", "2026-10-05", { name: " amina ", phone: "1" }), rec("c", "2026-10-06", {}), rec("d", "2026-10-07", {})];
  const r = aggregateRecords(records, { indicatorId: "i", method: "COUNT", dedupFields: ["name", "phone"] }, periods);
  assert.deepEqual(r.duplicates, ["a"]);
  assert.equal(r.periods[0].value, "3");
});

test("a mapping is checked against the form", () => {
  const fields = form.fields;
  assert.deepEqual(recordMappingProblems({ indicatorId: "i", method: "SUM", valueField: "kits", dateField: "visit_date" }, fields), []);
  assert.equal(recordMappingProblems({ indicatorId: "i", method: "SUM" }, fields).length, 1);
  assert.equal(recordMappingProblems({ indicatorId: "i", method: "SUM", valueField: "reason" }, fields).length, 1);
  assert.equal(recordMappingProblems({ indicatorId: "i", method: "COUNT", dateField: "site", dedupFields: ["zzz"] }, fields).length, 2);
});

test("yes/no answers compare the same as booleans and as words", () => {
  const c = { field: "a", op: "EQ", value: "yes" };
  assert.equal(conditionHolds(c, { a: true }), true);
  assert.equal(conditionHolds(c, { a: "Yes" }), true);
  assert.equal(conditionHolds(c, { a: false }), false);
  assert.equal(conditionHolds({ field: "a", op: "EQ", value: "no" }, { a: "false" }), true);
});

import { recordSheetErrorFile } from "../dist/index.js";

test("the sheet template is the form's own; rows are checked with the form's rules; the error file is the person's sheet with the problems", () => {
  const template = recordSheetTemplate(form);
  assert.match(template.split("\n")[0], /^Visit date,Attended,Reason absent,Kits given,Site,Where$/);
  // The template with its hint row filled in later is accepted, and the hint row itself is skipped.
  const sheet = [
    "Visit date,Attended,Reason absent,Kits given,Site,Where",
    "a date YYYY-MM-DD,yes or no,text (optional),a number (optional),A / B (optional),latitude, longitude (optional)".replace(/,latitude, longitude/, ',"latitude, longitude"'),
    "2026-10-03,yes,,4,A,",
    "2026-10-04,no,Ill,,b,\"1.5, 32.1\"",
    "2026-02-30,yes,,900,Z,",
    "2026-10-06,no,,,,",
  ].join("\n");
  const r = parseRecordSheet(form, sheet);
  assert.equal(r.rows.length, 4);
  assert.deepEqual([r.valid, r.invalid], [2, 2]);
  assert.deepEqual(r.rows[0].answers, { visit_date: "2026-10-03", attended: true, kits: 4, site: "a" });
  assert.deepEqual(r.rows[1].answers.where, { lat: 1.5, lon: 32.1 });
  assert.equal(r.rows[1].answers.site, "b");
  assert.match(r.rows[2].problems.join(" "), /real date/);
  assert.match(r.rows[3].problems.join(" "), /Reason absent is required/);
  const errors = recordSheetErrorFile(r).trim().split("\n");
  assert.equal(errors.length, 3);
  assert.match(errors[0], /,Problems$/);
  assert.match(errors[1], /^2026-02-30,/);
  assert.equal(r.rows[2].rowNumber, 5);
});

test("a sheet missing a required column, or with unknown columns, says so", () => {
  const r = parseRecordSheet(form, "Attended;Mystery\nyes;1");
  assert.deepEqual(r.missingColumns, ["Visit date"]);
  assert.deepEqual(r.unknownColumns, ["Mystery"]);
  assert.equal(r.invalid, 1);
  assert.equal(parseRecordSheet(form, "").rows.length, 0);
});

test("a photo or document question takes the id of an upload, and a sheet neither asks for it nor requires it", () => {
  const f = { fields: [{ key: "day", label: "Day", type: "DATE", required: true }, { key: "photo", label: "Photo", type: "FILE", required: true }] };
  assert.deepEqual(validateFormDefinition(f), []);
  assert.match(validateSubmission(f, { day: "2026-10-03" }).problems[0].message, /Photo is required/);
  assert.match(validateSubmission(f, { day: "2026-10-03", photo: "x y" }).problems[0].message, /attach a photo/);
  assert.equal(validateSubmission(f, { day: "2026-10-03", photo: "abc123def456" }).values.photo, "abc123def456");
  assert.equal(recordSheetTemplate(f).split("\n")[0], "Day");
  assert.equal(parseRecordSheet(f, "Day\n2026-10-03").invalid, 0);
});

test("an answer problem carries its kind and values, so a screen can say it in another language", () => {
  const f = { fields: [{ key: "n", label: "Kits", type: "NUMBER", min: 1, max: 5, required: true }, { key: "d", label: "Day", type: "DATE" }] };
  const one = (answers) => validateSubmission(f, answers).problems[0];
  assert.deepEqual([one({}).code, one({}).params], ["REQUIRED", { label: "Kits" }]);
  assert.deepEqual([one({ n: "x" }).code], ["NUMBER"]);
  assert.deepEqual([one({ n: 0 }).code, one({ n: 0 }).params], ["MIN", { label: "Kits", min: 1 }]);
  assert.deepEqual([one({ n: 9 }).code, one({ n: 9 }).params], ["MAX", { label: "Kits", max: 5 }]);
  assert.equal(one({ n: 2, d: "2026-02-30" }).code, "DATE");
  assert.match(one({ n: 0 }).message, /cannot be below 1/, "the English sentence is unchanged");
});
