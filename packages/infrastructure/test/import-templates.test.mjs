// Every import template, read back the way an upload is read: the data sheet's headers are the ones its parser reads,
// the instructions sheet is never imported, and its example rows, typed into the data sheet, import without a problem.
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  GUIDE_SHEET_NAME, parseActivityText, parseEvidenceText, parseIndicatorText, parseLogframeText,
  parsePlaceSheet, parseRegisterSheet, parseWorkPlanText,
} from "@donordesk/domain";
import {
  buildActivityTemplate, buildEvidenceTemplate, buildFinanceRegisterTemplate, buildIndicatorsTemplate,
  buildLogframeTemplate, buildPlacesTemplate, buildWorkPlanTemplate,
} from "../dist/index.js";
import { TolerantDocumentParser } from "../dist/parsers/document-parser.js";

const financeCtx = { lines: new Map([["bl-03", { id: "line-1", currency: "USD" }]]), sources: new Map([["unicef", "src-1"]]), primaryCurrency: "USD" };

const TEMPLATES = [
  { name: "work plan", build: buildWorkPlanTemplate, sheets: ["Work plan"], read: (t) => { const r = parseWorkPlanText(t); return { rows: r.rows, problems: r.problems }; } },
  { name: "places", build: buildPlacesTemplate, sheets: ["Places"], read: (t) => parsePlaceSheet(t) },
  { name: "finance register", build: buildFinanceRegisterTemplate, sheets: ["Finance register"], read: (t) => { const r = parseRegisterSheet(t, financeCtx); return { rows: r.rows, problems: [...r.missingColumns, ...r.unknownColumns, ...r.rows.flatMap((x) => x.problems)] }; } },
  { name: "activities", build: buildActivityTemplate, sheets: ["Activities"], read: (t) => { const r = parseActivityText(t); return { rows: r.rows, problems: r.rows.length ? r.warnings : [] }; } },
  { name: "evidence", build: buildEvidenceTemplate, sheets: ["Evidence"], read: (t) => { const r = parseEvidenceText(t); return { rows: r.rows, problems: r.rows.length ? r.warnings : [] }; } },
  { name: "indicators", build: buildIndicatorsTemplate, sheets: ["Indicators"], read: (t) => { const r = parseIndicatorText(t); return { rows: r.rows, problems: r.rows.length ? r.warnings : [] }; } },
  { name: "logframe", build: buildLogframeTemplate, sheets: ["Logframe", "Indicators"], read: (t) => { const r = parseLogframeText(t); return { rows: r.rows, problems: r.rows.length ? r.warnings : [] }; } },
];

const load = async (buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); return wb; };
const asUpload = async (buffer) => (await new TolerantDocumentParser().parse({ buffer, fileName: "upload.xlsx", fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).text;
const rowValues = (row) => Array.from({ length: row.cellCount }, (_, i) => row.getCell(i + 1).text);

/** The example tables of the instructions sheet: each one's header row and the rows under it. */
function guideExamples(guide) {
  const rows = [];
  guide.eachRow((row) => rows.push(rowValues(row)));
  const tables = [];
  rows.forEach((r, i) => { if (String(r[0]).startsWith("Example rows")) tables.push({ header: rows[i + 1], rows: [] }); else if (tables.length && i > 0 && !String(rows[i - 1][0]).startsWith("Example rows") && r.some((c) => c !== "")) tables.at(-1).rows.push(r); });
  assert.ok(tables.length > 0, "the instructions sheet has an example table");
  return tables;
}

/** Types each sheet's worked examples into it (from the table whose header is that sheet's header row). */
async function filledWithExamples(build, sheets) {
  const wb = await load(await build());
  const tables = guideExamples(wb.getWorksheet(GUIDE_SHEET_NAME));
  for (const name of sheets) {
    const data = wb.getWorksheet(name);
    const headers = rowValues(data.getRow(1));
    const table = tables.find((x) => headers.every((h, i) => x.header[i] === h));
    assert.ok(table, `the instructions sheet has examples for the ${name} sheet, with exactly its columns`);
    for (const r of table.rows) data.addRow(headers.map((_, i) => r[i] ?? ""));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

for (const t of TEMPLATES) {
  test(`${t.name} template: data sheet first, headers only, instructions sheet last`, async () => {
    const wb = await load(await t.build());
    assert.deepEqual(wb.worksheets.map((s) => s.name), [...t.sheets, GUIDE_SHEET_NAME]);
    for (const name of t.sheets) assert.equal(wb.getWorksheet(name).actualRowCount, 1, `${name} holds no example rows to delete`);
  });

  test(`${t.name} template: an untouched download imports nothing (the instructions are never data)`, async () => {
    const out = t.read(await asUpload(await t.build()));
    assert.equal(out.rows.length, 0);
  });

  test(`${t.name} template: every column is read and the worked examples import cleanly`, async () => {
    const out = t.read(await asUpload(await filledWithExamples(t.build, t.sheets)));
    assert.ok(out.rows.length > 0, "examples were imported");
    assert.deepEqual(out.problems, []);
  });
}

test("blank optional cells do not shift later columns (places: no parent, then a code and a pin)", async () => {
  const wb = await load(await buildPlacesTemplate());
  wb.getWorksheet("Places").addRow(["Uganda", "Country", "", "UG", "1.37", "32.29", "", ""]);
  const out = parsePlaceSheet(await asUpload(Buffer.from(await wb.xlsx.writeBuffer())));
  assert.deepEqual(out.problems, []);
  assert.equal(out.rows[0].code, "UG");
  assert.equal(out.rows[0].latitude, 1.37);
  assert.equal(out.rows[0].longitude, 32.29);
});

test("the activity template carries the end date into the import, and refuses one before the start", async () => {
  const wb = await load(await buildActivityTemplate());
  const sheet = wb.getWorksheet("Activities");
  const headers = rowValues(sheet.getRow(1));
  const row = (values) => headers.map((h) => values[h] ?? "");
  sheet.addRow(row({ "Activity Title": "Three-day training", "Activity Date": "2026-03-10", "Activity End Date": "2026-03-12", Summary: "Training of trainers." }));
  sheet.addRow(row({ "Activity Title": "Backwards", "Activity Date": "2026-03-10", "Activity End Date": "2026-03-01", Summary: "x" }));
  const out = parseActivityText(await asUpload(Buffer.from(await wb.xlsx.writeBuffer())));
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].activityEndDate.slice(0, 10), "2026-03-12");
  assert.match(out.warnings.join(" "), /end date is before the activity date/);
});

test("the whole-framework workbook gives results to the logframe import and indicators to the indicator import", async () => {
  const text = await asUpload(await filledWithExamples(buildLogframeTemplate, ["Logframe", "Indicators"]));
  const results = parseLogframeText(text);
  const indicators = parseIndicatorText(text);
  assert.deepEqual(results.rows.map((r) => r.code), ["G1", "O1.1", "O1.1.1", "A1.1.1.1"]);
  assert.equal(indicators.rows.length, 1);
  assert.equal(indicators.rows[0].logframeCode, "O1.1");
  assert.equal(indicators.rows[0].frequency, "Per survey");
});
