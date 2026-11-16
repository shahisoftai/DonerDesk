/**
 * The Entry Sheet's "By place" view (Phase 57; the DevResults layout): rows = places, columns = indicators. Pure: keys, paste from
 * Excel, what changed and which cells may be typed. A missing figure is "" (never 0); a place an indicator is not measured at, and a
 * locked column, are never changed by typing or pasting.
 */
export type SheetCell = "NOT_MEASURED_HERE" | { value: string; state: string; splits: ReadonlyArray<{ dimension: string; category: string; value: string }> };

export interface PlaceSheetData {
  columns: ReadonlyArray<{ indicatorId: string; code: string; name: string; type: string; unit?: string | null | undefined; adds: boolean; lock: string | null; due: boolean }>;
  rows: ReadonlyArray<{ placeId: string; name: string; path: string; level: number }>;
  cells: ReadonlyArray<ReadonlyArray<SheetCell>>;
  totals: ReadonlyArray<string | null>;
}

export const cellKey = (placeId: string, indicatorId: string) => `${placeId}|${indicatorId}`;

/** Whether a cell can be typed into. */
export function typable(sheet: PlaceSheetData, r: number, c: number): boolean {
  const cell = sheet.cells[r]?.[c];
  return !!cell && cell !== "NOT_MEASURED_HERE" && sheet.columns[c]?.lock === null;
}

/** The levels present, smallest first (country 0 … site 4). */
export function sheetLevels(sheet: PlaceSheetData): number[] {
  return [...new Set(sheet.rows.map((r) => r.level))].sort((a, b) => a - b);
}

/**
 * A block copied from Excel (tab-separated lines) pasted at a cell: fills right and down, skipping cells that cannot be typed into.
 * Returns the edits (key → text) and how many pasted values were skipped.
 */
export function pasteBlock(sheet: PlaceSheetData, rowOrder: readonly number[], start: { r: number; c: number }, text: string): { edits: Map<string, string>; skipped: number } {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const edits = new Map<string, string>();
  let skipped = 0;
  const at = rowOrder.indexOf(start.r);
  lines.forEach((line, i) => {
    const r = rowOrder[at + i];
    line.split("\t").forEach((raw, j) => {
      const c = start.c + j;
      if (r === undefined || c >= sheet.columns.length || !typable(sheet, r, c)) { if (raw.trim() !== "") skipped += 1; return; }
      edits.set(cellKey(sheet.rows[r]!.placeId, sheet.columns[c]!.indicatorId), raw.trim());
    });
  });
  return { edits, skipped };
}

const clean = (v: string) => v.replace(/[,\s]/g, "");
const NUMBER = /^-?\d+(\.\d+)?$/;

/** The typed cells that differ from what is stored, with the figure the person saw (so someone else's change is not overwritten). */
export function sheetChanges(sheet: PlaceSheetData, typed: ReadonlyMap<string, string>): Array<{ placeId: string; indicatorId: string; value: string; expected: string }> {
  const out: Array<{ placeId: string; indicatorId: string; value: string; expected: string }> = [];
  sheet.rows.forEach((row, r) => sheet.columns.forEach((col, c) => {
    const key = cellKey(row.placeId, col.indicatorId);
    if (!typed.has(key) || !typable(sheet, r, c)) return;
    const cell = sheet.cells[r]![c] as Exclude<SheetCell, "NOT_MEASURED_HERE">;
    const next = clean(typed.get(key)!);
    if (next !== clean(cell.value)) out.push({ placeId: row.placeId, indicatorId: col.indicatorId, value: next, expected: cell.value });
  }));
  return out;
}

/** Keys of typed cells that are not numbers (for number types); a sheet with any is not saved. */
export function badCells(sheet: PlaceSheetData, typed: ReadonlyMap<string, string>): Set<string> {
  const bad = new Set<string>();
  const numeric = new Set(sheet.columns.filter((c) => ["NUMBER", "CURRENCY", "PERCENTAGE", "RATIO"].includes(c.type)).map((c) => c.indicatorId));
  for (const [key, value] of typed) {
    const v = clean(value);
    if (v !== "" && numeric.has(key.split("|")[1]!) && (!NUMBER.test(v) || Number(v) < 0)) bad.add(key);
  }
  return bad;
}

/** The column total shown while typing: the places' figures added up for a count (typed values over stored ones), null for a rate. */
export function liveTotal(sheet: PlaceSheetData, typed: ReadonlyMap<string, string>, c: number): string | null {
  const col = sheet.columns[c]!;
  if (!col.adds) return null;
  let sum = 0;
  let any = false;
  sheet.rows.forEach((row, r) => {
    const cell = sheet.cells[r]![c]!;
    if (cell === "NOT_MEASURED_HERE") return;
    const v = clean(typed.get(cellKey(row.placeId, col.indicatorId)) ?? cell.value);
    if (v === "" || !NUMBER.test(v)) return;
    any = true;
    sum += Number(v);
  });
  return any ? String(Math.round(sum * 1e9) / 1e9) : "";
}
