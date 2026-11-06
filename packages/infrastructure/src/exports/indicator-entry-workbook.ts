import ExcelJS from "exceljs";
import { ENTRY_FILE_HEADERS, entryFileRows, type EntryFileItem } from "@donordesk/domain";

export const ENTRY_FILE_SHEET = "Indicator values";
export const ENTRY_FILE_NAME = "donordesk-indicator-values.xlsx";

export interface EntryWorkbookItem extends EntryFileItem {
  type: string;
  unit?: string | undefined;
}

const NUMBER = /^-?\d+(\.\d+)?$/;
/** A typed number is written as a number; a Yes/No or a word stays text. Never a formula. */
const asCell = (v: string): string | number => (NUMBER.test(v) && v.replace(/^-/, "").replace(".", "").length <= 15 && !/^-?0\d/.test(v) ? Number(v) : v);

/** The cell's value as text, whatever the file holds in it (a number, a date, rich text, a formula's result). */
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
 * The entry sheet as a workbook: one row per indicator, the columns an import reads back, typed columns shaded, locked rows grey,
 * and data validation so a typo is caught in Excel before it is imported (a number where a number is needed, Yes/No, 0-100 for a
 * percentage). The indicator id sits in a hidden column so a renamed code still matches.
 */
export async function buildIndicatorEntryWorkbook(items: ReadonlyArray<EntryWorkbookItem>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();
  const sheet = wb.addWorksheet(ENTRY_FILE_SHEET);
  const table = entryFileRows(items);
  const [header, ...body] = table;
  sheet.addRow(header);
  for (const r of body) sheet.addRow(r.map((c, i) => (i >= 5 && i <= 6 ? asCell(c) : c)));

  const widths = [14, 44, 12, 14, 14, 20, 16, 30, 28, 12, 8];
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  head.alignment = { vertical: "middle", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
  sheet.getColumn(10).hidden = true;
  sheet.getColumn(11).hidden = true;

  items.forEach((item, i) => {
    const rowNumber = i + 2;
    const row = sheet.getRow(rowNumber);
    for (const col of [6, 7, 8, 9]) {
      const cell = row.getCell(col);
      if (item.locked) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
        cell.font = { italic: true, color: { argb: "FF6B7280" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
      }
    }
    if (item.locked) return;
    for (const col of [6, 7]) {
      const cell = row.getCell(col);
      if (item.type === "YES_NO") cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"YES,NO"'], showErrorMessage: true, errorTitle: "Yes or No", error: "Choose YES or NO." };
      else if (item.type === "TEXT" || item.type === "CUSTOM" || item.type === "RATIO") continue;
      else if (item.type === "PERCENTAGE" || (item.unit ?? "").trim() === "%") cell.dataValidation = { type: "decimal", operator: "between", allowBlank: true, formulae: [0, 100], showErrorMessage: true, errorTitle: "Percentage", error: "Enter a number from 0 to 100." };
      else cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Number", error: "Enter a number, or leave the cell empty." };
    }
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ENTRY_FILE_HEADERS.length } };

  const info = wb.addWorksheet("Read me");
  info.addRow(["Fill the shaded cells in \"Indicator values\", save the file, and import it from the Entry Sheet. Grey rows are locked and are never changed by an import. Leave a cell empty when nothing is recorded: empty is not the same as 0."]);
  info.getColumn(1).width = 110;
  info.getRow(1).alignment = { wrapText: true, vertical: "top" };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The first sheet of an uploaded workbook (the one named "Indicator values" when there is one) as rows of text; blank rows dropped. */
export async function readIndicatorEntryWorkbook(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet(ENTRY_FILE_SHEET) ?? wb.worksheets[0];
  if (!sheet) return [];
  const width = Math.max(sheet.columnCount, ENTRY_FILE_HEADERS.length);
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c += 1) cells.push(text(row.getCell(c).value).trim());
    rows.push(cells);
  });
  return rows.filter((r) => r.some((c) => c !== ""));
}
