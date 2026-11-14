import ExcelJS from "exceljs";
import { GUIDE_SHEET_NAME } from "@donordesk/domain";

/** One column of an import template: the header the parser reads, its width, whether a row needs it, and what it takes. */
export interface TemplateColumn {
  header: string;
  width: number;
  required: boolean;
  takes: string;
  example: string;
  /** Allowed words, offered as a drop-down in the data sheet. */
  choices?: ReadonlyArray<string>;
}

interface ListValidation {
  type: "list";
  allowBlank: boolean;
  formulae: string[];
  error?: string;
  errorTitle?: string;
  showErrorMessage?: boolean;
}

/** exceljs ships `worksheet.dataValidations` at run time but its typings omit it. */
function validations(sheet: ExcelJS.Worksheet): { add(address: string, v: ListValidation): void } {
  return (sheet as unknown as { dataValidations: { add(address: string, v: ListValidation): void } }).dataValidations;
}

/** Printed one page wide, landscape: a template is wider than it is long. */
const PRINT: Partial<ExcelJS.PageSetup> = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

const columnLetter = (n: number): string => (n <= 26 ? String.fromCharCode(64 + n) : columnLetter(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26)));

export function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (let i = 1; i <= columnCount; i++) header.getCell(i).border = { bottom: { style: "thin", color: { argb: "FFB0B0B0" } } };
}

/**
 * The data sheet: headers only, frozen, with drop-downs for columns that take fixed words. It is the first sheet,
 * so it is what an import reads; there are no example rows in it to delete.
 */
export function addDataSheet(wb: ExcelJS.Workbook, name: string, columns: ReadonlyArray<TemplateColumn>, rows = 500): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(name, { pageSetup: PRINT });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: c.width }));
  styleHeaderRow(sheet, columns.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${columnLetter(columns.length)}1` };
  columns.forEach((c, i) => {
    const letter = columnLetter(i + 1);
    if (c.required) sheet.getCell(`${letter}1`).note = "Required";
    if (c.choices?.length) {
      validations(sheet).add(`${letter}2:${letter}${rows + 1}`, {
        type: "list", allowBlank: !c.required, formulae: [`"${c.choices.join(",")}"`],
        error: `${c.header} must be one of: ${c.choices.join(", ")}.`, errorTitle: `Invalid ${c.header}`, showErrorMessage: true,
      });
    }
    // Dates and codes stay text, so Excel never turns 2026-03-12 into a serial number the import cannot trust.
    sheet.getColumn(i + 1).numFmt = "@";
  });
  return sheet;
}

/** A worked example: its own column set, so a two-sheet workbook shows one table per sheet. */
export interface ExampleTable {
  title: string;
  columns: ReadonlyArray<TemplateColumn>;
  rows: ReadonlyArray<Record<string, string>>;
}

/** The instructions sheet: one line per column and worked examples. Imports skip it by name, so the examples are never data. */
export function addGuideSheet(wb: ExcelJS.Workbook, intro: ReadonlyArray<string>, columns: ReadonlyArray<TemplateColumn>, examples: ReadonlyArray<Record<string, string>> | ReadonlyArray<ExampleTable> = []): void {
  const sheet = wb.addWorksheet(GUIDE_SHEET_NAME, { pageSetup: PRINT });
  const tables: ReadonlyArray<ExampleTable> = isTables(examples)
    ? examples
    : [{ title: "Example rows (copy the layout into the first sheet; this sheet is not imported)", columns, rows: examples.length ? examples : [Object.fromEntries(columns.map((c) => [c.header, c.example]))] }];
  // The column guide uses A–C and each example table its own columns: every column is as wide as the widest use.
  const guideWidths = [28, 12, 70];
  const span = Math.max(3, ...tables.map((t) => t.columns.length));
  sheet.columns = Array.from({ length: span }, (_, i) => ({ width: Math.max(guideWidths[i] ?? 0, ...tables.map((t) => t.columns[i]?.width ?? 0)) }));
  for (const line of intro) sheet.addRow([line]).font = { italic: true };
  sheet.addRow([]);
  const head = sheet.addRow(["Column", "Required", "What to write"]);
  head.font = { bold: true };
  for (const c of columns) {
    const row = sheet.addRow([c.header, c.required ? "Yes" : "No", c.choices?.length ? `${c.takes} (${c.choices.join(", ")})` : c.takes]);
    row.alignment = { vertical: "top" };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  }
  for (const t of tables) {
    sheet.addRow([]);
    sheet.addRow([t.title]).font = { bold: true };
    sheet.addRow(t.columns.map((c) => c.header)).font = { bold: true };
    for (const ex of t.rows) sheet.addRow(t.columns.map((c) => ex[c.header] ?? ""));
  }
}

const isTables = (x: ReadonlyArray<unknown>): x is ReadonlyArray<ExampleTable> => x.length > 0 && typeof x[0] === "object" && x[0] !== null && "columns" in x[0];

export async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();
  return wb;
}

/** Templates are static content: each is built once per process and reused for every download. */
export function cachedBuild(build: () => Promise<Buffer>): () => Promise<Buffer> {
  let cached: Promise<Buffer> | null = null;
  return () => (cached ??= build().catch((e) => { cached = null; throw e; }));
}
