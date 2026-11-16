/**
 * The by-place sheet as a file (Phase 57; the DevResults layout): one tab per admin level, rows = places, columns = indicators.
 * Pure: the workbook is drawn and read by infrastructure from these tables.
 *
 * - Row 1 is for people (place, path, "CODE Name" per indicator); row 2 is hidden and holds the ids, so a renamed code still matches.
 * - Column A (hidden) holds the place id; a row without one is matched by its path, then by a unique name.
 * - An empty cell leaves the stored figure as it is (an import never clears a figure); "—" marks a place an indicator is not
 *   measured at; a locked column is shown and never applied. Any bad cell blocks the whole file and is named.
 */
import { NOT_MEASURED_HERE, type PlaceSheet, type PlaceSheetEdit } from "./place-agenda.js";

export const PLACE_SHEET_IDS_MARK = "#ids";
export const NOT_MEASURED_MARK = "—";
export const LEVEL_TAB_NAMES: Readonly<Record<number, string>> = { 0: "Countries", 1: "Provinces", 2: "Districts", 3: "Sub-districts", 4: "Sites" };

export interface PlaceSheetTab {
  name: string;
  /** rows[0] = people's header, rows[1] = ids, then one row per place. */
  rows: string[][];
  /** Per indicator column (0-based within the indicator columns): locked, and whether a number is expected. */
  columns: Array<{ locked: boolean; numeric: boolean; percent: boolean }>;
  /** Per place row: which indicator columns are not measured there. */
  notMeasured: boolean[][];
}

/** Leading columns before the indicators: place id (hidden), place, path. */
export const PLACE_LEAD_COLUMNS = 3;

const NUMERIC_TYPES = new Set(["NUMBER", "CURRENCY", "PERCENTAGE", "RATIO"]);

export function placeSheetTabs(sheet: PlaceSheet): PlaceSheetTab[] {
  const levels = [...new Set(sheet.rows.map((r) => r.level))].sort((a, b) => a - b);
  return levels.map((level) => {
    const rowIdx = sheet.rows.map((r, i) => (r.level === level ? i : -1)).filter((i) => i >= 0);
    const header = ["Place id", "Place", "Where", ...sheet.columns.map((c) => `${c.code} ${c.name}${c.unit ? ` (${c.unit})` : ""}`)];
    const ids = [PLACE_SHEET_IDS_MARK, "", "", ...sheet.columns.map((c) => c.indicatorId)];
    const body = rowIdx.map((i) => {
      const row = sheet.rows[i]!;
      return [row.placeId, row.name, row.path, ...sheet.cells[i]!.map((cell) => (cell === NOT_MEASURED_HERE ? NOT_MEASURED_MARK : cell.value))];
    });
    return {
      name: LEVEL_TAB_NAMES[level] ?? `Level ${level}`,
      rows: [header, ids, ...body],
      columns: sheet.columns.map((c) => ({ locked: c.lock !== null, numeric: NUMERIC_TYPES.has(c.type), percent: c.type === "PERCENTAGE" })),
      notMeasured: rowIdx.map((i) => sheet.cells[i]!.map((cell) => cell === NOT_MEASURED_HERE)),
    };
  });
}

export interface PlaceSheetFileResult {
  edits: PlaceSheetEdit[];
  /** Plain sentences naming the tab, row and column; any problem blocks the whole file. */
  problems: string[];
  /** Cells left as they are because the file holds the stored figure or an empty cell. */
  unchanged: number;
}

const clean = (v: string) => v.replace(/[,\s]/g, "");

/** Reads uploaded tabs (each a table of text) against the current sheet. Unknown places or indicators are named, never applied. */
export function parsePlaceSheetTabs(sheet: PlaceSheet, tabs: ReadonlyArray<{ name: string; rows: string[][] }>): PlaceSheetFileResult {
  const problems: string[] = [];
  const edits: PlaceSheetEdit[] = [];
  let unchanged = 0;
  const rowIndexById = new Map(sheet.rows.map((r, i) => [r.placeId, i]));
  const byPath = new Map(sheet.rows.map((r, i) => [r.path.trim().toLowerCase(), i]));
  const nameCount = new Map<string, number[]>();
  sheet.rows.forEach((r, i) => nameCount.set(r.name.trim().toLowerCase(), [...(nameCount.get(r.name.trim().toLowerCase()) ?? []), i]));
  const colById = new Map(sheet.columns.map((c, i) => [c.indicatorId, i]));
  const colByCode = new Map(sheet.columns.map((c, i) => [c.code.trim().toLowerCase(), i]));

  for (const tab of tabs) {
    if (tab.rows.length < 2) continue;
    const header = tab.rows[0]!;
    const idsRow = tab.rows[1]![0]?.trim() === PLACE_SHEET_IDS_MARK ? tab.rows[1]! : null;
    const columnOf: Array<number | null> = [];
    for (let c = PLACE_LEAD_COLUMNS; c < header.length; c += 1) {
      const id = idsRow?.[c]?.trim() ?? "";
      const code = (header[c] ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      const found = (id ? colById.get(id) : undefined) ?? colByCode.get(code);
      if (found === undefined) {
        if ((header[c] ?? "").trim()) problems.push(`${tab.name}: the column "${header[c]}" is not an indicator measured by place in this project.`);
        columnOf.push(null);
      } else columnOf.push(found);
    }
    const body = tab.rows.slice(idsRow ? 2 : 1);
    body.forEach((cells, b) => {
      const line = b + (idsRow ? 3 : 2);
      if (cells.every((c) => !c.trim())) return;
      const id = cells[0]?.trim() ?? "";
      let r = id ? rowIndexById.get(id) : undefined;
      if (r === undefined) r = byPath.get((cells[2] ?? "").trim().toLowerCase());
      if (r === undefined) { const hits = nameCount.get((cells[1] ?? "").trim().toLowerCase()); if (hits?.length === 1) r = hits[0]; }
      if (r === undefined) { problems.push(`${tab.name}, row ${line}: "${cells[1] || cells[0]}" is not one of this project's places.`); return; }
      columnOf.forEach((col, k) => {
        if (col === null) return;
        const raw = (cells[PLACE_LEAD_COLUMNS + k] ?? "").trim();
        if (raw === "" ) return;
        const column = sheet.columns[col]!;
        const cell = sheet.cells[r!]![col]!;
        const where = `${tab.name}, row ${line}, ${column.code}`;
        if (cell === NOT_MEASURED_HERE) {
          if (raw !== NOT_MEASURED_MARK) problems.push(`${where}: ${column.code} is not measured at ${sheet.rows[r!]!.name}.`);
          return;
        }
        if (raw === NOT_MEASURED_MARK) { problems.push(`${where}: "—" means not measured; leave the cell empty instead.`); return; }
        if (clean(raw) === clean(cell.value)) { unchanged += 1; return; }
        if (column.lock) { problems.push(`${where}: this figure is locked (${column.lock.toLowerCase().replace(/_/g, " ")}) and cannot be changed by an import.`); return; }
        if (NUMERIC_TYPES.has(column.type)) {
          const n = Number(clean(raw));
          if (!Number.isFinite(n)) { problems.push(`${where}: "${raw}" is not a number.`); return; }
          if (n < 0) { problems.push(`${where}: a figure cannot be below zero.`); return; }
          if (column.type === "PERCENTAGE" && n > 100) { problems.push(`${where}: a percentage is from 0 to 100.`); return; }
        }
        edits.push({ placeId: sheet.rows[r!]!.placeId, indicatorId: column.indicatorId, value: clean(raw) });
      });
    });
  }
  return { edits, problems, unchanged };
}
