import ExcelJS from "exceljs";
import { FINANCE_SHEET_HEADERS, INDICATOR_SHEET_HEADERS, PIVOT_MEASURE_LABEL, financeSheetRows, indicatorSheetRows, pivotSheet, type DataSheet, type PivotMeasure } from "@donordesk/domain";

export const DATA_SHEET_FILENAME = "donordesk-data-sheet.xlsx";
const INDICATORS_SHEET = "Indicators";
/** Columns (1-based) a person may change; the rest identify the row or are calculated. */
const EDITABLE = new Set([11, 12, 15, 16]);
const NUMBER = /^-?\d+(\.\d+)?$/;

/** Numbers are written as numbers (so the sheet can chart and sum them); everything else stays text, never a formula. */
const asCell = (v: string): string | number => (NUMBER.test(v) && v.replace(/^-/, "").replace(".", "").length <= 15 && !/^-?0\d/.test(v) ? Number(v) : v);

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  row.alignment = { vertical: "middle", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
}

function addTable(wb: ExcelJS.Workbook, name: string, headers: readonly string[], rows: string[][]): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(name);
  sheet.addRow([...headers]);
  for (const r of rows) sheet.addRow(r.map(asCell));
  headers.forEach((h, i) => {
    sheet.getColumn(i + 1).width = Math.min(40, Math.max(12, h.length + 4));
  });
  styleHeader(sheet);
  return sheet;
}

/**
 * The project's whole data sheet as a workbook: "Indicators" (one row per indicator per period, the sheet an import reads
 * back), one grid per measure (indicators down, periods across) and "Finance". Editable columns are shaded.
 */
export async function buildDataSheetWorkbook(sheet: DataSheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();

  const main = addTable(wb, INDICATORS_SHEET, INDICATOR_SHEET_HEADERS, indicatorSheetRows(sheet));
  main.getColumn(2).width = 40;
  main.getColumn(8).width = 22;
  for (const col of EDITABLE) {
    main.getColumn(col).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
    });
  }
  main.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: INDICATOR_SHEET_HEADERS.length } };

  for (const measure of ["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"] as PivotMeasure[]) {
    const pivot = pivotSheet(sheet, measure);
    addTable(wb, PIVOT_MEASURE_LABEL[measure].replace("%", "Pct"), pivot.headers, pivot.rows);
  }

  if (sheet.finance.length > 0) addTable(wb, "Finance", FINANCE_SHEET_HEADERS, financeSheetRows(sheet));

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

const text = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return text(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((p) => p.text).join("");
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value);
};

/** Rows of the "Indicators" worksheet (or the first one) as plain strings, for the import preview. */
export async function readDataSheetWorkbook(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet(INDICATORS_SHEET) ?? wb.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  const width = sheet.columnCount;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c += 1) cells.push(text(row.getCell(c).value).trim());
    rows.push(cells);
  });
  return rows.filter((r) => r.some((c) => c !== ""));
}
