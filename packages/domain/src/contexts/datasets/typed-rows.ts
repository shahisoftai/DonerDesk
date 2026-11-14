import { columnKind } from "./column-kinds.js";
import type { CellValue, ColumnDef, RawTable } from "./model.js";
import { isBlank } from "./parse-cells.js";

/** A row after columns are confirmed: values by column key, read by the column's kind. `fileRow` is the row number in the person's sheet. */
export interface TypedRow { fileRow: number; values: Record<string, CellValue> }

export interface UnreadableCell { fileRow: number; column: string; raw: string }

/**
 * Reads every cell by its column's kind. A cell that cannot be read is null in the row and listed in `unreadable` (the checks name it);
 * an empty cell is null and not listed. `firstFileRow` is the sheet row of the first data row (header row + 1).
 */
export function typeRows(table: RawTable, columns: readonly ColumnDef[], firstFileRow = 2): { rows: TypedRow[]; unreadable: UnreadableCell[] } {
  const index = columns.map((c) => table.headers.indexOf(c.sourceHeader));
  const unreadable: UnreadableCell[] = [];
  const rows = table.rows.map((r, n) => {
    const values: Record<string, CellValue> = {};
    columns.forEach((c, k) => {
      const raw = index[k]! >= 0 ? r[index[k]!] : null;
      const read = columnKind(c.kind)?.parse(raw ?? null);
      if (read === undefined) { values[c.key] = null; if (!isBlank(raw ?? null)) unreadable.push({ fileRow: firstFileRow + n, column: c.key, raw: String(raw) }); }
      else values[c.key] = read;
    });
    return { fileRow: firstFileRow + n, values };
  });
  return { rows, unreadable };
}
