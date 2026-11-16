import ExcelJS from "exceljs";
import { PLACE_LEAD_COLUMNS, placeSheetTabs, type PlaceSheet } from "@donordesk/domain";

export const PLACE_SHEET_FILE_NAME = "donordesk-values-by-place.xlsx";

const NUMBER = /^-?\d+(\.\d+)?$/;
const asCell = (v: string): string | number => (NUMBER.test(v) && v.length <= 15 && !/^-?0\d/.test(v) ? Number(v) : v);

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("text" in value) return String((value as { text: unknown }).text);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return "";
  }
  return String(value);
}

/**
 * The by-place sheet as a workbook (Phase 57, the DevResults layout): one tab per admin level, rows = places, columns = indicators.
 * Place ids sit in hidden column A and indicator ids in hidden row 2, so renamed places and codes still match on import.
 * Typed cells are shaded, locked columns and "not measured here" cells are grey, numbers are validated in Excel.
 */
export async function buildPlaceSheetWorkbook(sheet: PlaceSheet, periodLabel: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();
  for (const tab of placeSheetTabs(sheet)) {
    const ws = wb.addWorksheet(tab.name.slice(0, 31));
    tab.rows.forEach((r, i) => ws.addRow(i < 2 ? r : r.map((c, k) => (k >= PLACE_LEAD_COLUMNS ? asCell(c) : c))));
    ws.getColumn(1).hidden = true;
    ws.getRow(2).hidden = true;
    ws.getColumn(2).width = 24;
    ws.getColumn(3).width = 36;
    for (let k = 0; k < tab.columns.length; k += 1) ws.getColumn(PLACE_LEAD_COLUMNS + 1 + k).width = 18;
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    head.alignment = { vertical: "middle", wrapText: true };
    ws.views = [{ state: "frozen", ySplit: 2, xSplit: PLACE_LEAD_COLUMNS }];
    tab.notMeasured.forEach((row, r) => {
      const excelRow = ws.getRow(r + 3);
      tab.columns.forEach((col, k) => {
        const cell = excelRow.getCell(PLACE_LEAD_COLUMNS + 1 + k);
        if (row[k] || col.locked) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
          cell.font = { italic: true, color: { argb: "FF6B7280" } };
          return;
        }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
        if (col.percent) cell.dataValidation = { type: "decimal", operator: "between", allowBlank: true, formulae: [0, 100], showErrorMessage: true, errorTitle: "Percentage", error: "Enter a number from 0 to 100." };
        else if (col.numeric) cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Number", error: "Enter a number, or leave the cell empty." };
      });
    });
  }
  const info = wb.addWorksheet("Read me");
  info.addRow([`Values by place for ${periodLabel}. Each tab is one level of places; each column is an indicator. Fill the shaded cells, save, and import the file from the Entry Sheet (By place). Grey cells are locked or not measured at that place (—) and are never changed. An empty cell leaves the stored figure as it is; empty is not the same as 0. Totals are worked out from the places.`]);
  info.getColumn(1).width = 110;
  info.getRow(1).alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Every tab of an uploaded by-place workbook as rows of text (the "Read me" tab skipped; blank rows dropped). */
export async function readPlaceSheetWorkbook(buffer: Buffer): Promise<Array<{ name: string; rows: string[][] }>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const tabs: Array<{ name: string; rows: string[][] }> = [];
  for (const ws of wb.worksheets) {
    if (ws.name === "Read me") continue;
    const width = ws.columnCount;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= width; c += 1) cells.push(text(row.getCell(c).value).trim());
      rows.push(cells);
    });
    tabs.push({ name: ws.name, rows: rows.filter((r) => r.some((c) => c !== "")) });
  }
  return tabs;
}
