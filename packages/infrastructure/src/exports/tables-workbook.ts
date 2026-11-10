import ExcelJS from "exceljs";
import type { ITablesWorkbookWriter, WorkbookTable } from "@donordesk/application";

const FORBIDDEN_IN_SHEET_NAME = /[\\/?*[\]:]/g;

/** A sheet name Excel accepts: at most 31 characters, none of \ / ? * [ ] :, and unique after the cut. */
export function sheetNames(names: ReadonlyArray<string>): string[] {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base = raw.replace(FORBIDDEN_IN_SHEET_NAME, " ").trim().slice(0, 31) || `Table ${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * Tables as a workbook: one sheet each, a bold header row, numbers written as numbers and an empty cell left empty (a gap is never a
 * zero). A text cell is a string cell, never a formula, whatever it starts with.
 */
export class ExcelTablesWorkbookWriter implements ITablesWorkbookWriter {
  async write(tables: ReadonlyArray<WorkbookTable>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "DonorDesk";
    const names = sheetNames(tables.map((t) => t.name));
    tables.forEach((t, i) => {
      const ws = wb.addWorksheet(names[i]!);
      const header = ws.addRow(t.columns);
      header.font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      for (const r of t.rows) {
        ws.addRow(r);
      }
      ws.columns.forEach((col, ci) => { col.width = Math.min(48, Math.max(10, ...[t.columns[ci] ?? "", ...t.rows.slice(0, 200).map((r) => String(r[ci] ?? ""))].map((s) => s.length + 2))); });
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
