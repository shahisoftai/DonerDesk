import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PlaceTree, placeSheet, parsePlaceSheetTabs } from "@donordesk/domain";
import { buildPlaceSheetWorkbook, readPlaceSheetWorkbook } from "../dist/index.js";

const P = (id, name, adminLevel, parentId) => ({ id, name, kind: "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false });
const tree = new PlaceTree([P("C", "Country", 0), P("A", "Province A", 1, "C"), P("D1", "District 1", 2, "A"), P("D2", "District 2", 2, "A")]);
const sheet = placeSheet({
  tree, areas: [{ placeId: "A" }],
  indicators: [{ id: "i1", code: "1.1", name: "Screened", type: "NUMBER", setting: { scope: "LEVEL", level: 2 }, due: true }],
  values: [{ indicatorId: "i1", status: "DRAFT", breakdown: [{ dimension: "LOCATION", category: "District 1", value: "7", placeId: "D1" }] }],
});

test("the by-place workbook: one tab per level, hidden ids, and a typed cell read back by the same rule the import uses", async () => {
  const buffer = await buildPlaceSheetWorkbook(sheet, "Nov 2026");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Districts");
  assert.ok(ws, "a Districts tab");
  assert.equal(ws.getColumn(1).hidden, true);
  assert.equal(ws.getRow(2).hidden, true);
  ws.getRow(4).getCell(4).value = 12; // District 2, indicator 1.1
  const typed = Buffer.from(await wb.xlsx.writeBuffer());
  const tabs = await readPlaceSheetWorkbook(typed);
  const read = parsePlaceSheetTabs(sheet, tabs);
  assert.deepEqual(read.problems, []);
  assert.deepEqual(read.edits, [{ placeId: "D2", indicatorId: "i1", value: "12" }]);
  assert.equal(read.unchanged, 1);
});

test("an untouched download changes nothing", async () => {
  const tabs = await readPlaceSheetWorkbook(await buildPlaceSheetWorkbook(sheet, "Nov 2026"));
  const read = parsePlaceSheetTabs(sheet, tabs);
  assert.deepEqual(read.edits, []);
  assert.deepEqual(read.problems, []);
});
