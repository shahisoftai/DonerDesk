import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { ExcelTablesWorkbookWriter, } from "../dist/index.js";
import { sheetNames } from "../dist/exports/tables-workbook.js";

test("sheet names are valid for Excel and unique after the cut", () => {
  const names = sheetNames(["Results: Q1/Q2?", "x".repeat(40), "x".repeat(40), ""]);
  assert.ok(names.every((n) => n.length <= 31 && !/[\\/?*[\]:]/.test(n)));
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length);
  assert.equal(names[3], "Table 4");
});

test("numbers stay numbers, a gap stays empty, and text that looks like a formula stays text", async () => {
  const bytes = await new ExcelTablesWorkbookWriter().write([{ name: "T", columns: ["Place", "Value"], rows: [["Turkana", 12], ["Wajir", null], ["=SUM(A1)", "+1"]] }]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  const ws = wb.getWorksheet("T");
  assert.equal(ws.getRow(2).getCell(2).value, 12);
  assert.equal(ws.getRow(3).getCell(2).value, null);
  assert.equal(ws.getRow(4).getCell(1).value, "=SUM(A1)");
  assert.equal(typeof ws.getRow(4).getCell(1).value, "string");
  assert.equal(ws.getRow(1).getCell(1).font.bold, true);
});
