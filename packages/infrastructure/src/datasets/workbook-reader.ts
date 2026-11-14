import ExcelJS from "exceljs";
import { DomainError, MAX_COLUMNS, MAX_ROWS, err, ok, type CellValue, type Result, type Workbook } from "@donordesk/domain";
import type { IWorkbookReader } from "@donordesk/application";

/**
 * Reads an uploaded table (Phase 54): xlsx through exceljs, csv by its own delimiter (comma, semicolon or tab). Formula cells are read as
 * their stored result, never evaluated; dates become plain days. Reading stops at the limits so a huge file cannot exhaust memory.
 */
const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

function cellValue(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return dayOf(v);
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return null;
  }
  return String(v);
}

export function parseDelimited(text: string): CellValue[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, first.split(d).length - 1] as const).sort((a, b) => b[1] - a[1]);
  const delim = counts[0]![1] > 0 ? counts[0]![0] : ",";
  const rows: CellValue[][] = [];
  let row: CellValue[] = [], cell = "", quoted = false;
  const push = () => { row.push(cell.trim() === "" ? null : cell.trim()); cell = ""; };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) push();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      push();
      rows.push(row); row = [];
      if (rows.length > MAX_ROWS + 60) break;
    } else cell += ch;
  }
  if (cell !== "" || row.length) { push(); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== null));
}

export class ExcelWorkbookReader implements IWorkbookReader {
  async read(bytes: Buffer, fileName: string): Promise<Result<Workbook & { format: "XLSX" | "CSV" }>> {
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!zip) {
      const text = bytes.toString("utf8").replace(/^﻿/, "");
      return ok({ format: "CSV", sheets: [{ name: fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "") || "Sheet1", cells: parseDelimited(text) }] });
    }
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bytes as unknown as ArrayBuffer);
      const sheets: Workbook["sheets"] = [];
      wb.eachSheet((sheet) => {
        if (sheet.state && sheet.state !== "visible") return;
        const cells: CellValue[][] = [];
        sheet.eachRow({ includeEmpty: true }, (row, n) => {
          if (n > MAX_ROWS + 60) return;
          const values: CellValue[] = [];
          for (let c = 1; c <= Math.min(row.cellCount, MAX_COLUMNS + 5); c += 1) values.push(cellValue(row.getCell(c).value));
          cells[n - 1] = values;
        });
        for (let i = 0; i < cells.length; i += 1) cells[i] ??= [];
        // Merged cells: only the master holds the value; a "Fill down" step copies it where the person wants.
        if (cells.some((r) => r.some((c) => c !== null))) sheets.push({ name: sheet.name, cells });
      });
      return ok({ format: "XLSX", sheets });
    } catch {
      return err(DomainError.validation("The spreadsheet could not be read. Save it again as .xlsx or .csv and upload it."));
    }
  }
}
