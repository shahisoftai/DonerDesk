import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildIndicatorEntryWorkbook, readIndicatorEntryWorkbook, ENTRY_FILE_NAME } from "../dist/index.js";
import { parseIndicatorSheetTable } from "@donordesk/domain";

const item = (over = {}) => ({ id: "i1", code: "OUT-1", name: "People trained", type: "NUMBER", unit: "people", baseline: "0", target: "100", previousCumulative: "40", periodAchievement: "10", cumulativeAchievement: "50", comments: "ok", dataSource: "register", locked: false, ...over });
const items = [item(), item({ id: "i2", code: "OUT-2", name: "Verified one", periodAchievement: "3", cumulativeAchievement: "3", locked: true }), item({ id: "i3", code: "OUT-3", type: "YES_NO", periodAchievement: "YES", cumulativeAchievement: "" }), item({ id: "i4", code: "OUT-4", type: "PERCENTAGE", unit: "%", periodAchievement: "", cumulativeAchievement: "" })];

test("the workbook has a header, frozen panes, hidden id and locked columns, shaded typed cells and a read-me sheet", async () => {
  const buffer = await buildIndicatorEntryWorkbook(items);
  assert.equal(ENTRY_FILE_NAME, "donordesk-indicator-values.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet("Indicator values");
  assert.ok(sheet);
  assert.equal(sheet.getRow(1).getCell(6).value, "Period achievement");
  assert.equal(sheet.getColumn(10).hidden, true);
  assert.equal(sheet.getColumn(11).hidden, true);
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.getRow(2).getCell(6).value, 10, "a typed number is a number, not text");
  assert.equal(sheet.getRow(2).getCell(6).fill.fgColor.argb, "FFFFF8E1", "typed cells are shaded");
  assert.equal(sheet.getRow(3).getCell(6).fill.fgColor.argb, "FFE5E7EB", "a locked row is grey");
  assert.ok(wb.getWorksheet("Read me"));
});

test("data validation catches a typo in Excel: numbers, Yes/No, 0-100; none on a locked row", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildIndicatorEntryWorkbook(items));
  const sheet = wb.getWorksheet("Indicator values");
  assert.equal(sheet.getRow(2).getCell(6).dataValidation.type, "decimal");
  assert.equal(sheet.getRow(3).getCell(6).dataValidation, undefined);
  assert.equal(sheet.getRow(4).getCell(6).dataValidation.type, "list");
  const pct = sheet.getRow(5).getCell(6).dataValidation;
  assert.deepEqual([pct.type, pct.formulae], ["decimal", [0, 100]]);
});

test("a downloaded file read back gives the same table, and the importer matches every row by id", async () => {
  const table = await readIndicatorEntryWorkbook(await buildIndicatorEntryWorkbook(items));
  assert.equal(table[0][0], "Code");
  assert.deepEqual(table[1].slice(0, 10), ["OUT-1", "People trained", "0", "100", "40", "10", "50", "ok", "register", "i1"]);
  const parsed = parseIndicatorSheetTable(table[0], table.slice(1), items.map(({ id, code, name }) => ({ id, code, name })));
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.rows.length, 4);
  assert.ok(parsed.rows.every((r) => r.matched));
  assert.deepEqual(parsed.rows.map((r) => r.locked), [false, true, false, false]);
  assert.equal(parsed.rows[3].periodAchievement, "", "an empty cell stays empty, never 0");
});

test("a person's edited file reads back what they typed, numbers and text alike", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildIndicatorEntryWorkbook(items));
  const sheet = wb.getWorksheet("Indicator values");
  sheet.getRow(2).getCell(6).value = 12.5;
  sheet.getRow(2).getCell(8).value = { richText: [{ text: "seen " }, { text: "twice" }] };
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const table = await readIndicatorEntryWorkbook(buf);
  assert.equal(table[1][5], "12.5");
  assert.equal(table[1][7], "seen twice");
});

test("a file that is not a workbook is refused by the reader", async () => {
  await assert.rejects(() => readIndicatorEntryWorkbook(Buffer.from("not a workbook")));
});
