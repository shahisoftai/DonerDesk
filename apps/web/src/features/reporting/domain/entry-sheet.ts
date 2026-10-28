/**
 * The Entry Sheet (Phase 34.2): indicator values entered like a spreadsheet. This file is the whole behaviour of the grid with no
 * React in it: which cells exist, what state each is in, how the selection moves, what a paste from Excel does, how fill, clear
 * and undo work, and the one write plan that goes to the server. The screen only draws it and forwards keys.
 *
 * One rule per concept: whether a typed value is possible is `indicatorValueProblem` (domain), the suggested running total is
 * `suggestRunningTotal` (domain), and the save is the same bulk upsert the form view uses. The sheet adds no second write path.
 * A missing value is "", never 0; a locked, verified or calculated cell is never changed by paste, fill, clear or undo.
 */
import { indicatorValueProblem } from "@donordesk/domain/contexts/logframe/indicator-value-rules.js";
import { parseEntryNumber, suggestRunningTotal } from "@donordesk/domain/contexts/logframe/indicator-entry-suggestions.js";
import { isRateIndicator } from "@donordesk/domain/contexts/reporting/export-indicator-columns.js";

/* ---------- columns ---------- */

export type EditableColumn = "periodAchievement" | "cumulativeAchievement" | "comments" | "dataSource";
export type BaseColumnKey = "code" | "name" | "baseline" | "target" | "previous" | EditableColumn | "percentOfTarget" | "status";
/** An earlier period's value, shown beside the open period for context (read-only): `history:<periodId>`. */
export type HistoryColumnKey = `history:${string}`;
export type SheetColumnKey = BaseColumnKey | HistoryColumnKey;

export interface SheetColumn {
  key: SheetColumnKey;
  /** Message key of the heading (`sheet.col.*`). */
  labelKey: string;
  editable: boolean;
  /** Stays in view while the sheet scrolls sideways. */
  frozen: boolean;
  /** Pixels at the comfortable density. */
  width: number;
  align: "start" | "end";
}

const col = (key: SheetColumnKey, labelKey: string, o: Partial<Pick<SheetColumn, "editable" | "frozen" | "width" | "align">> = {}): SheetColumn => ({
  key,
  labelKey,
  editable: false,
  frozen: false,
  width: 120,
  align: "start",
  ...o,
});

/** The columns, in order. The first two are frozen so a code and a name are always beside the figure being typed. */
export const SHEET_COLUMNS: readonly SheetColumn[] = [
  col("code", "sheet.col.code", { frozen: true, width: 92 }),
  col("name", "sheet.col.name", { frozen: true, width: 220 }),
  col("baseline", "sheet.col.baseline", { align: "end", width: 84 }),
  col("target", "sheet.col.target", { align: "end", width: 104 }),
  col("previous", "sheet.col.previous", { align: "end", width: 104 }),
  col("periodAchievement", "sheet.col.period", { editable: true, align: "end", width: 124 }),
  col("cumulativeAchievement", "sheet.col.cumulative", { editable: true, align: "end", width: 124 }),
  col("comments", "sheet.col.comments", { editable: true, width: 170 }),
  col("dataSource", "sheet.col.source", { editable: true, width: 170 }),
  // After the four typed columns, so a block copied from Excel (period, cumulative, notes, source) lands on them one to one.
  col("percentOfTarget", "sheet.col.percent", { align: "end", width: 124 }),
  col("status", "sheet.col.status", { width: 130 }),
];

export const EDITABLE_COLUMNS: readonly EditableColumn[] = SHEET_COLUMNS.filter((c) => c.editable).map((c) => c.key as EditableColumn);
export const FROZEN_COLUMN_COUNT = SHEET_COLUMNS.filter((c) => c.frozen).length;

/** Spreadsheet-style column letters: A, B, … Z, AA, AB. */
export function columnLetters(index: number): string {
  let n = Math.max(0, Math.trunc(index));
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** The address of a cell as a spreadsheet shows it: column letters and a 1-based row number ("F3"). */
export const cellAddress = (cell: Cell): string => `${columnLetters(cell.col)}${cell.row + 1}`;

/* ---------- rows and values ---------- */

/** What the sheet needs to know about one indicator row (a structural subset of the server's period row). */
export interface SheetRow {
  id: string;
  code: string;
  name: string;
  type: string;
  unit?: string | undefined;
  baseline: string;
  target: string;
  aggregation: string;
  /** Set when the value is calculated from other indicators: it is never typed. */
  calculation?: string | undefined;
  previousCumulative?: string | undefined;
  disaggregationRequired: boolean;
  /** The saved value's state and version, when one is saved. */
  update?: { verificationStatus: string; updatedAt: string; notApplicableReason?: string | undefined } | null | undefined;
}

export interface SheetValues<D = unknown> {
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
  /** Set = "applies not this period"; the figures are then empty. */
  notApplicableReason: string;
  disaggregation: D[];
}

export type ValuesById<D = unknown> = Record<string, SheetValues<D>>;

export interface SheetContext {
  /** May this person enter values at all. */
  canEdit: boolean;
  /** Set when the entry window is closed to this person right now (the sentence the server gave). */
  closedReason?: string | null | undefined;
}

export type LockReason = "VERIFIED" | "CALCULATED" | "CLOSED" | "READ_ONLY";

/** Why a row cannot be typed into, or null when it can. Order matters: a verified value is locked whatever else is true. */
export function lockReason(row: SheetRow, ctx: SheetContext): LockReason | null {
  if (row.calculation) return "CALCULATED";
  if (row.update?.verificationStatus === "VERIFIED") return "VERIFIED";
  if (!ctx.canEdit) return "READ_ONLY";
  if (ctx.closedReason) return "CLOSED";
  return null;
}

const CUMULATIVE_INDEX = SHEET_COLUMNS.findIndex((c) => c.key === "cumulativeAchievement");
const NUMERIC_COLUMNS: readonly EditableColumn[] = ["periodAchievement", "cumulativeAchievement"];
export const isFigureColumn = (c: EditableColumn | SheetColumnKey): c is "periodAchievement" | "cumulativeAchievement" => (NUMERIC_COLUMNS as readonly string[]).includes(c);

/** Yes/No indicators take a word, never a number; their cells are normalised to YES / NO. */
export function normaliseCellText(row: SheetRow, column: EditableColumn, raw: string): string {
  const text = raw.replace(/\u00a0/g, " ").trim();
  if (row.type === "YES_NO" && isFigureColumn(column)) {
    if (/^(yes|y|true|1)$/i.test(text)) return "YES";
    if (/^(no|n|false|0)$/i.test(text)) return "NO";
  }
  return isFigureColumn(column) ? text : raw.replace(/[\r\n]+/g, " ").trimEnd();
}

/** The plain-words reason a typed value cannot be right, or null (empty is fine). The one rule is the domain's. */
export function cellProblem(row: SheetRow, column: EditableColumn, text: string): string | null {
  if (!isFigureColumn(column)) return text.length > 2000 ? "This text is too long." : null;
  return indicatorValueProblem({ code: row.code, type: row.type, unit: row.unit, baseline: row.baseline, target: row.target, formula: row.calculation }, text, column === "periodAchievement" ? "period" : "cumulative");
}

/** "% of target" for display only: cumulative (else period) over a positive numeric target; none for a rate, a yes/no or a gap. */
export function percentOfTarget(row: SheetRow, values: SheetValues): number | null {
  if (isRateIndicator({ type: row.type, unit: row.unit }) || row.type === "YES_NO" || values.notApplicableReason.trim() !== "") return null;
  const target = parseEntryNumber(row.target);
  const value = parseEntryNumber(values.cumulativeAchievement) ?? parseEntryNumber(values.periodAchievement);
  if (target === undefined || target <= 0 || value === undefined) return null;
  return Math.round((value / target) * 1000) / 10;
}

/* ---------- cell state ---------- */

export type CellState = "calculated" | "verified" | "closed" | "read-only" | "not-applicable" | "invalid" | "unsaved" | "returned" | "submitted" | "saved" | "empty";

/**
 * What state a cell is in, for its colour, icon and words (never the colour alone). `initial` is what the server last had.
 * Order is the order of precedence.
 */
export function cellState(row: SheetRow, column: EditableColumn, values: SheetValues, initial: SheetValues, ctx: SheetContext): CellState {
  const lock = lockReason(row, ctx);
  if (lock === "CALCULATED") return "calculated";
  if (lock === "VERIFIED") return "verified";
  if (lock === "CLOSED") return "closed";
  if (lock === "READ_ONLY") return "read-only";
  if (isFigureColumn(column) && values.notApplicableReason.trim() !== "") return "not-applicable";
  const text = values[column];
  if (cellProblem(row, column, text) !== null) return "invalid";
  if (text !== initial[column]) return "unsaved";
  if (text.trim() === "") return "empty";
  const status = row.update?.verificationStatus;
  if (status === "NEEDS_CORRECTION") return "returned";
  if (status === "SUBMITTED") return "submitted";
  return "saved";
}

/* ---------- selection and keyboard ---------- */

export interface Cell { row: number; col: number }
export interface Selection { anchor: Cell; focus: Cell }
export interface CellRange { r1: number; c1: number; r2: number; c2: number }
export interface Dims { rows: number; cols: number }

export const selectionOf = (cell: Cell): Selection => ({ anchor: cell, focus: cell });

export function rangeOf(s: Selection): CellRange {
  return { r1: Math.min(s.anchor.row, s.focus.row), c1: Math.min(s.anchor.col, s.focus.col), r2: Math.max(s.anchor.row, s.focus.row), c2: Math.max(s.anchor.col, s.focus.col) };
}

export const rangeSize = (r: CellRange): number => (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
export const inRange = (r: CellRange, cell: Cell): boolean => cell.row >= r.r1 && cell.row <= r.r2 && cell.col >= r.c1 && cell.col <= r.c2;

const clamp = (n: number, hi: number): number => Math.max(0, Math.min(hi, n));

export interface KeyInput { key: string; shift?: boolean; ctrl?: boolean }

/** First and last editable column, used by Home/End and Tab so the cursor travels between the cells a person types into. */
export function editableBounds(columns: readonly SheetColumn[]): { first: number; last: number } {
  const first = columns.findIndex((c) => c.editable);
  const last = columns.length - 1 - [...columns].reverse().findIndex((c) => c.editable);
  return first < 0 ? { first: 0, last: Math.max(0, columns.length - 1) } : { first, last };
}

/**
 * Where the selection goes for a movement key; null when the key is not a movement. Shift extends the range from its anchor.
 * Tab and Enter wrap to the next row like a spreadsheet; Ctrl+arrow jumps to the edge.
 */
export function moveSelection(sel: Selection, input: KeyInput, dims: Dims, columns: readonly SheetColumn[] = SHEET_COLUMNS): Selection | null {
  if (dims.rows === 0 || dims.cols === 0) return null;
  const { first: FIRST_EDITABLE, last: LAST_EDITABLE } = editableBounds(columns);
  const maxR = dims.rows - 1;
  const maxC = dims.cols - 1;
  let { row, col } = sel.focus;
  switch (input.key) {
    case "ArrowUp": row = input.ctrl ? 0 : row - 1; break;
    case "ArrowDown": row = input.ctrl ? maxR : row + 1; break;
    case "ArrowLeft": col = input.ctrl ? 0 : col - 1; break;
    case "ArrowRight": col = input.ctrl ? maxC : col + 1; break;
    case "PageUp": row -= 10; break;
    case "PageDown": row += 10; break;
    case "Home": col = input.ctrl ? 0 : FIRST_EDITABLE; if (input.ctrl) row = 0; break;
    case "End": col = input.ctrl ? maxC : LAST_EDITABLE; if (input.ctrl) row = maxR; break;
    case "Enter": row += input.shift ? -1 : 1; break;
    case "Tab":
      if (input.shift) { if (col <= FIRST_EDITABLE) { col = LAST_EDITABLE; row -= 1; } else col -= 1; }
      else if (col >= LAST_EDITABLE) { col = FIRST_EDITABLE; row += 1; } else col += 1;
      break;
    default: return null;
  }
  const next = { row: clamp(row, maxR), col: clamp(col, maxC) };
  // Enter and Tab never extend a range; the arrows and paging do when Shift is held.
  const extend = Boolean(input.shift) && input.key !== "Enter" && input.key !== "Tab";
  return extend ? { anchor: sel.anchor, focus: next } : selectionOf(next);
}

/* ---------- changes, undo and redo ---------- */

export type ChangeColumn = EditableColumn | "notApplicableReason";
export interface Change { rowId: string; column: ChangeColumn; before: string; after: string }

/** The values after applying changes (forward). Never mutates; a row the changes do not touch is the same object. */
export function applyChanges<D>(values: ValuesById<D>, changes: ReadonlyArray<Change>): ValuesById<D> {
  if (changes.length === 0) return values;
  const next: ValuesById<D> = { ...values };
  for (const c of changes) {
    const row = next[c.rowId];
    if (row) next[c.rowId] = { ...row, [c.column]: c.after };
  }
  return next;
}

export const invertChanges = (changes: ReadonlyArray<Change>): Change[] => [...changes].reverse().map((c) => ({ ...c, before: c.after, after: c.before }));

export interface History { undo: Change[][]; redo: Change[][] }
export const emptyHistory = (): History => ({ undo: [], redo: [] });
export const HISTORY_LIMIT = 100;

/** Records one action (a typed cell, a paste, a fill) as one undo step. A step that changes nothing is not recorded. */
export function recordChange(h: History, changes: ReadonlyArray<Change>): History {
  const real = changes.filter((c) => c.before !== c.after);
  if (real.length === 0) return h;
  return { undo: [...h.undo, real].slice(-HISTORY_LIMIT), redo: [] };
}

export function undoStep(h: History): { history: History; apply: Change[] } | null {
  const last = h.undo[h.undo.length - 1];
  if (!last) return null;
  return { history: { undo: h.undo.slice(0, -1), redo: [...h.redo, last] }, apply: invertChanges(last) };
}

export function redoStep(h: History): { history: History; apply: Change[] } | null {
  const last = h.redo[h.redo.length - 1];
  if (!last) return null;
  return { history: { undo: [...h.undo, last], redo: h.redo.slice(0, -1) }, apply: last.map((c) => ({ ...c })) };
}

/* ---------- editing one cell ---------- */

/**
 * The changes for typing `raw` into one cell. Editing the period value fills the running total of a SUM indicator while that
 * total is empty or still holds the suggestion made for the previous period value (so a person's own total is never replaced).
 * Typing a figure into a "not applicable" row clears the reason, as the server rule does. Stateless: the suggestion is recomputed.
 */
export function planEdit(row: SheetRow, column: EditableColumn, raw: string, values: SheetValues): Change[] {
  const text = normaliseCellText(row, column, raw);
  if (text === values[column]) return [];
  const changes: Change[] = [{ rowId: row.id, column, before: values[column], after: text }];
  if (isFigureColumn(column) && text !== "" && values.notApplicableReason.trim() !== "") {
    changes.push({ rowId: row.id, column: "notApplicableReason", before: values.notApplicableReason, after: "" });
  }
  if (column === "periodAchievement") {
    const old = suggestRunningTotal({ aggregation: row.aggregation, periodValue: values.periodAchievement, previousCumulative: row.previousCumulative });
    const untouched = values.cumulativeAchievement.trim() === "" || values.cumulativeAchievement === old;
    const next = suggestRunningTotal({ aggregation: row.aggregation, periodValue: text, previousCumulative: row.previousCumulative });
    const after = untouched ? (next ?? (values.cumulativeAchievement === old ? "" : values.cumulativeAchievement)) : values.cumulativeAchievement;
    if (after !== values.cumulativeAchievement) changes.push({ rowId: row.id, column: "cumulativeAchievement", before: values.cumulativeAchievement, after });
  }
  return changes;
}

/* ---------- clipboard ---------- */

/** Reads tab-separated text as copied from Excel or Google Sheets: quoted cells may hold tabs, quotes ("") and line breaks. */
export function parseClipboard(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** Text for copying a range back out as tab-separated lines. Cells with a tab, quote or line break are quoted. */
export function toClipboardText(cells: ReadonlyArray<ReadonlyArray<string>>): string {
  const q = (s: string) => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return cells.map((r) => r.map(q).join("\t")).join("\n");
}

/** What a column shows for a row, as plain text: for copying and for screen readers. */
export type HistoryLookup = (rowId: string, periodId: string) => string;

export function cellText(row: SheetRow, column: SheetColumnKey, values: SheetValues, history?: HistoryLookup): string {
  if (column.startsWith("history:")) return history?.(row.id, column.slice("history:".length)) ?? "";
  switch (column as BaseColumnKey) {
    case "code": return row.code;
    case "name": return row.name;
    case "baseline": return row.baseline;
    case "target": return row.target ? `${row.target}${row.unit ? ` ${row.unit}` : ""}` : "";
    case "previous": return row.previousCumulative ?? "";
    case "percentOfTarget": { const p = percentOfTarget(row, values); return p === null ? "" : `${p}%`; }
    case "status": return row.update?.verificationStatus ?? "";
    default: return values[column as EditableColumn];
  }
}

export interface PasteProblem { rowId: string; code: string; column: EditableColumn; message: string }

export interface PastePlan {
  changes: Change[];
  /** Pasted values that cannot be right: not applied, and named. */
  problems: PasteProblem[];
  /** Cells in locked rows (verified, calculated, closed, read-only), left as they were. */
  skippedLocked: number;
  /** Cells that fell on a read-only column (Code, Target, % of target…). */
  skippedReadonly: number;
  unchanged: number;
  /** Pasted rows and columns that did not fit in the sheet. */
  overflowRows: number;
  overflowCols: number;
  /** Cells that were set. */
  applied: number;
}

/**
 * What pasting `text` at `anchor` does. A single pasted value fills the whole selected range (like a spreadsheet); a block lands with
 * its top-left cell at the anchor. Locked rows and read-only columns are skipped and counted; an impossible value is reported, never
 * stored. A figure pasted into a "not applicable" row clears the reason (one undo step).
 */
export function planPaste(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; ctx: SheetContext; anchor: Cell; range?: CellRange | undefined; text: string; columns?: readonly SheetColumn[] }): PastePlan {
  const columns = input.columns ?? SHEET_COLUMNS;
  const cumulativeIndex = columns.findIndex((c) => c.key === "cumulativeAchievement");
  const grid = parseClipboard(input.text);
  const plan: PastePlan = { changes: [], problems: [], skippedLocked: 0, skippedReadonly: 0, unchanged: 0, overflowRows: 0, overflowCols: 0, applied: 0 };
  if (grid.length === 0) return plan;
  const single = grid.length === 1 && grid[0]!.length === 1;
  const range = input.range && single && rangeSize(input.range) > 1 ? input.range : undefined;
  const height = range ? range.r2 - range.r1 + 1 : grid.length;
  const width = range ? range.c2 - range.c1 + 1 : Math.max(...grid.map((r) => r.length));
  const top = range ? range.r1 : input.anchor.row;
  const left = range ? range.c1 : input.anchor.col;
  // The working copy, so two pasted cells of one row (period then cumulative) see each other.
  const working: ValuesById = { ...input.values };
  for (let i = 0; i < height; i += 1) {
    const r = top + i;
    if (r >= input.rows.length) { plan.overflowRows += 1; continue; }
    const row = input.rows[r]!;
    for (let j = 0; j < width; j += 1) {
      const c = left + j;
      if (c >= columns.length) { if (i === 0) plan.overflowCols += 1; continue; }
      const column = columns[c]!;
      const raw = range ? grid[0]![0]! : (grid[i]?.[j] ?? "");
      if (!column.editable) { plan.skippedReadonly += 1; continue; }
      if (lockReason(row, input.ctx)) { plan.skippedLocked += 1; continue; }
      const editable = column.key as EditableColumn;
      const text = normaliseCellText(row, editable, raw);
      const problem = cellProblem(row, editable, text);
      if (problem) { plan.problems.push({ rowId: row.id, code: row.code, column: editable, message: problem }); continue; }
      const current = working[row.id]!;
      const changes = planEdit(row, editable, text, current);
      if (changes.length === 0) { plan.unchanged += 1; continue; }
      // A pasted period value suggests the running total only when the paste did not bring its own for this row.
      const bringsCumulative = editable === "periodAchievement" && !range && cumulativeIndex >= 0 && left <= cumulativeIndex && left + width > cumulativeIndex;
      const kept = bringsCumulative ? changes.filter((x) => x.column !== "cumulativeAchievement") : changes;
      plan.changes.push(...kept);
      plan.applied += 1;
      working[row.id] = applyChanges({ [row.id]: current }, kept)[row.id]!;
    }
  }
  return plan;
}

/* ---------- fill and clear ---------- */

/** Ctrl+D: the first row's value of each selected column is copied down the range. Locked rows and read-only columns are skipped. */
export function planFillDown(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; ctx: SheetContext; range: CellRange; columns?: readonly SheetColumn[] }): { changes: Change[]; skippedLocked: number } {
  const { range } = input;
  const columns = input.columns ?? SHEET_COLUMNS;
  const out: Change[] = [];
  let skippedLocked = 0;
  if (range.r2 <= range.r1) return { changes: out, skippedLocked };
  const working: ValuesById = { ...input.values };
  for (let c = range.c1; c <= range.c2; c += 1) {
    const column = columns[c];
    if (!column?.editable) continue;
    const source = working[input.rows[range.r1]!.id]![column.key as EditableColumn];
    for (let r = range.r1 + 1; r <= range.r2; r += 1) {
      const row = input.rows[r]!;
      if (lockReason(row, input.ctx)) { skippedLocked += 1; continue; }
      const problem = cellProblem(row, column.key as EditableColumn, source);
      if (problem) continue;
      const changes = planEdit(row, column.key as EditableColumn, source, working[row.id]!);
      out.push(...changes);
      working[row.id] = applyChanges({ [row.id]: working[row.id]! }, changes)[row.id]!;
    }
  }
  return { changes: out, skippedLocked };
}

/**
 * Delete on a range: every editable, unlocked cell with something in it becomes empty. `clearsSaved` counts the values the server
 * already holds, so the screen can ask before clearing them.
 */
export function planClear(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; initial: ValuesById; ctx: SheetContext; range: CellRange; columns?: readonly SheetColumn[] }): { changes: Change[]; clearsSaved: number } {
  const columns = input.columns ?? SHEET_COLUMNS;
  const changes: Change[] = [];
  let clearsSaved = 0;
  for (let r = input.range.r1; r <= input.range.r2; r += 1) {
    const row = input.rows[r];
    if (!row || lockReason(row, input.ctx)) continue;
    for (let c = input.range.c1; c <= input.range.c2; c += 1) {
      const column = columns[c];
      if (!column?.editable) continue;
      const key = column.key as EditableColumn;
      const before = input.values[row.id]![key];
      if (before === "") continue;
      changes.push({ rowId: row.id, column: key, before, after: "" });
      if ((input.initial[row.id]?.[key] ?? "") !== "") clearsSaved += 1;
    }
  }
  return { changes, clearsSaved };
}

/** Marks rows "not applicable this period" (a reason is required) or clears the mark. The figures are emptied, never left as 0. */
export function planNotApplicable(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; ctx: SheetContext; rowIds: ReadonlyArray<string>; reason: string }): Change[] {
  const reason = input.reason.trim();
  const out: Change[] = [];
  for (const id of input.rowIds) {
    const row = input.rows.find((r) => r.id === id);
    const v = input.values[id];
    if (!row || !v || lockReason(row, input.ctx) || row.calculation) continue;
    if (v.notApplicableReason !== reason) out.push({ rowId: id, column: "notApplicableReason", before: v.notApplicableReason, after: reason });
    if (reason !== "") {
      if (v.periodAchievement !== "") out.push({ rowId: id, column: "periodAchievement", before: v.periodAchievement, after: "" });
      if (v.cumulativeAchievement !== "") out.push({ rowId: id, column: "cumulativeAchievement", before: v.cumulativeAchievement, after: "" });
    }
  }
  return out;
}

/* ---------- what changed, and the one write plan ---------- */

const sameDisaggregation = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean => JSON.stringify(a) === JSON.stringify(b);

/** A row whose values equal what the server has is clean: typing a value back to what it was (or undoing) removes it from the unsaved set. */
export function rowIsClean(initial: SheetValues, current: SheetValues): boolean {
  return (
    initial.periodAchievement === current.periodAchievement &&
    initial.cumulativeAchievement === current.cumulativeAchievement &&
    initial.comments === current.comments &&
    initial.dataSource === current.dataSource &&
    initial.notApplicableReason.trim() === current.notApplicableReason.trim() &&
    sameDisaggregation(initial.disaggregation, current.disaggregation)
  );
}

export function changedRowIds(initial: ValuesById, current: ValuesById): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(current)) if (initial[id] && !rowIsClean(initial[id]!, current[id]!)) out.add(id);
  return out;
}

export interface WriteRow<D> {
  indicatorId: string;
  expectedUpdatedAt?: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
  notApplicableReason: string;
  disaggregation?: D[];
}

/**
 * The rows to send for the changed indicators. The same shape the form view sends (it is the same bulk save): the version the person
 * saw goes along so a save over someone else's change is refused; "" clears; a reason makes the row "not applicable"; a breakdown is
 * sent when the indicator requires one or one was typed, with empty entries dropped.
 */
export function toWritePlan<D extends { category: string; value: string }>(rows: ReadonlyArray<SheetRow>, values: ValuesById<D>, changed: ReadonlySet<string>): WriteRow<D>[] {
  return rows
    .filter((row) => changed.has(row.id))
    .map((row) => {
      const v = values[row.id]!;
      const withBreakdown = row.disaggregationRequired || v.disaggregation.length > 0;
      return {
        indicatorId: row.id,
        ...(row.update ? { expectedUpdatedAt: row.update.updatedAt } : {}),
        periodAchievement: v.periodAchievement,
        cumulativeAchievement: v.cumulativeAchievement,
        comments: v.comments,
        dataSource: v.dataSource,
        notApplicableReason: v.notApplicableReason.trim(),
        ...(withBreakdown ? { disaggregation: v.disaggregation.filter((e) => e.category.trim() || e.value.trim()) } : {}),
      };
    });
}

/* ---------- summary ---------- */

export interface SheetSummary {
  rows: number;
  unsavedRows: number;
  invalidCells: number;
  emptyCells: number;
  lockedRows: number;
}

/** Counts for the sheet's status line: what is unsaved, what is invalid, what is still empty, what is locked. */
export function summarise(rows: ReadonlyArray<SheetRow>, values: ValuesById, initial: ValuesById, ctx: SheetContext): SheetSummary {
  const s: SheetSummary = { rows: rows.length, unsavedRows: 0, invalidCells: 0, emptyCells: 0, lockedRows: 0 };
  for (const row of rows) {
    const v = values[row.id]!;
    if (lockReason(row, ctx)) { s.lockedRows += 1; continue; }
    if (!rowIsClean(initial[row.id]!, v)) s.unsavedRows += 1;
    for (const c of NUMERIC_COLUMNS) {
      if (cellProblem(row, c, v[c]) !== null) s.invalidCells += 1;
      else if (v[c].trim() === "" && v.notApplicableReason.trim() === "") s.emptyCells += 1;
    }
  }
  return s;
}

/* ---------- which columns are shown: hide, reorder, resize, earlier periods ---------- */

/** What a person chose about the columns; kept per browser. Frozen columns (Code, Indicator) can be resized but never hidden or moved. */
export interface ColumnPrefs {
  hidden: SheetColumnKey[];
  /** Keys in the wanted order; keys not listed keep their default place after the listed ones. */
  order: SheetColumnKey[];
  widths: Partial<Record<SheetColumnKey, number>>;
}

export const emptyPrefs = (): ColumnPrefs => ({ hidden: [], order: [], widths: {} });
export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 480;

const isFrozen = (key: SheetColumnKey): boolean => SHEET_COLUMNS.some((c) => c.key === key && c.frozen);

/** Columns for earlier periods, oldest first, read-only, for context while typing this period's value. */
export function historyColumns(periods: ReadonlyArray<{ id: string; label: string }>): SheetColumn[] {
  return periods.map((p) => ({ key: `history:${p.id}` as HistoryColumnKey, labelKey: `history:${p.label}`, editable: false, frozen: false, width: 96, align: "end" as const }));
}

/** The columns to draw: the standard ones plus any earlier-period columns, minus the hidden, in the chosen order, at the chosen widths. */
export function resolveColumns(prefs: ColumnPrefs, extra: readonly SheetColumn[] = []): SheetColumn[] {
  const all = [...SHEET_COLUMNS.filter((c) => c.frozen), ...extra, ...SHEET_COLUMNS.filter((c) => !c.frozen)];
  const hidden = new Set(prefs.hidden.filter((k) => !isFrozen(k)));
  const rank = new Map(prefs.order.map((k, i) => [k, i]));
  const frozen = all.filter((c) => c.frozen);
  const rest = all.filter((c) => !c.frozen && !hidden.has(c.key));
  const indexOf = new Map(rest.map((c, i) => [c.key, i]));
  rest.sort((a, b) => (rank.get(a.key) ?? 1000 + indexOf.get(a.key)!) - (rank.get(b.key) ?? 1000 + indexOf.get(b.key)!));
  return [...frozen, ...rest].map((c) => {
    const w = prefs.widths[c.key];
    return w === undefined ? c : { ...c, width: Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(w))) };
  });
}

export function resizeColumn(prefs: ColumnPrefs, key: SheetColumnKey, width: number): ColumnPrefs {
  const w = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)));
  return { ...prefs, widths: { ...prefs.widths, [key]: w } };
}

/** Shows or hides a column. At least one editable column always stays, so the sheet can never be left with nothing to type into. */
export function toggleColumn(prefs: ColumnPrefs, key: SheetColumnKey): ColumnPrefs {
  if (isFrozen(key)) return prefs;
  if (prefs.hidden.includes(key)) return { ...prefs, hidden: prefs.hidden.filter((k) => k !== key) };
  const remaining = EDITABLE_COLUMNS.filter((c) => c !== key && !prefs.hidden.includes(c));
  if ((EDITABLE_COLUMNS as readonly string[]).includes(key) && remaining.length === 0) return prefs;
  return { ...prefs, hidden: [...prefs.hidden, key] };
}

/** Moves a column one place left or right among the movable ones (history columns included). */
export function moveColumn(prefs: ColumnPrefs, columns: readonly SheetColumn[], key: SheetColumnKey, direction: -1 | 1): ColumnPrefs {
  const movable = columns.filter((c) => !c.frozen).map((c) => c.key);
  const i = movable.indexOf(key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= movable.length) return prefs;
  const next = [...movable];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return { ...prefs, order: next };
}

export type Density = "comfortable" | "compact";
export interface SheetPrefs { columns: ColumnPrefs; density: Density; zoom: number; showRefs: boolean; autosave: boolean }
export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 1.5;
export const defaultSheetPrefs = (): SheetPrefs => ({ columns: emptyPrefs(), density: "comfortable", zoom: 1, showRefs: false, autosave: true });

/** Reads saved preferences defensively: anything that is not what we wrote falls back to the default, field by field. */
export function parseSheetPrefs(raw: string | null | undefined): SheetPrefs {
  const d = defaultSheetPrefs();
  if (!raw) return d;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return d; }
  if (typeof v !== "object" || v === null) return d;
  const o = v as Record<string, unknown>;
  const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string").slice(0, 60) : []);
  const widths: Partial<Record<SheetColumnKey, number>> = {};
  if (typeof o.columns === "object" && o.columns !== null) {
    const w = (o.columns as Record<string, unknown>).widths;
    if (typeof w === "object" && w !== null) for (const [k, n] of Object.entries(w)) if (typeof n === "number" && Number.isFinite(n)) widths[k as SheetColumnKey] = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(n)));
  }
  const cols = (typeof o.columns === "object" && o.columns !== null ? o.columns : {}) as Record<string, unknown>;
  const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(o.zoom * 20) / 20)) : d.zoom;
  return {
    columns: { hidden: strs(cols.hidden) as SheetColumnKey[], order: strs(cols.order) as SheetColumnKey[], widths },
    density: o.density === "compact" ? "compact" : "comfortable",
    zoom,
    showRefs: o.showRefs === true,
    autosave: o.autosave !== false,
  };
}

/* ---------- which rows are shown: filter, search, sort ---------- */

export type RowFilter = "ALL" | "EMPTY" | "UNSAVED" | "INVALID" | "RETURNED" | "LOCKED" | "OPEN";
export type RowSort = "LEVEL" | "CODE" | "NAME" | "STATUS" | "PERCENT";
export const ROW_FILTERS: readonly RowFilter[] = ["ALL", "EMPTY", "UNSAVED", "INVALID", "RETURNED", "LOCKED", "OPEN"];
export const ROW_SORTS: readonly RowSort[] = ["LEVEL", "CODE", "NAME", "STATUS", "PERCENT"];

/** Status order for sorting, what needs attention first: nothing entered, returned, draft, handed in, verified. */
const STATUS_RANK: Readonly<Record<string, number>> = { "": 0, NEEDS_CORRECTION: 1, DRAFT: 2, SUBMITTED: 3, VERIFIED: 4 };

const fold = (t: string): string => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** The ids of the rows to show, in order. Sorting is stable, so equal rows keep the sheet's own order ("LEVEL" is that order). */
export function viewRowIds(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; initial: ValuesById; ctx: SheetContext; filter: RowFilter; sort: RowSort; search: string }): string[] {
  const { rows, values, initial, ctx } = input;
  const q = fold(input.search.trim());
  const keep = rows.filter((row) => {
    if (q && !fold(`${row.code} ${row.name}`).includes(q)) return false;
    const v = values[row.id]!;
    const locked = lockReason(row, ctx) !== null;
    switch (input.filter) {
      case "ALL": return true;
      case "LOCKED": return locked;
      case "OPEN": return !locked;
      case "UNSAVED": return !locked && !rowIsClean(initial[row.id]!, v);
      case "RETURNED": return row.update?.verificationStatus === "NEEDS_CORRECTION";
      case "INVALID": return !locked && NUMERIC_COLUMNS.some((c) => cellProblem(row, c, v[c]) !== null);
      case "EMPTY": return !locked && v.notApplicableReason.trim() === "" && NUMERIC_COLUMNS.some((c) => v[c].trim() === "");
    }
  });
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const key = (row: SheetRow): string | number => {
    switch (input.sort) {
      case "CODE": return fold(row.code);
      case "NAME": return fold(row.name);
      case "STATUS": return STATUS_RANK[row.update?.verificationStatus ?? ""] ?? 2;
      case "PERCENT": return percentOfTarget(row, values[row.id]!) ?? -1;
      case "LEVEL": return order.get(row.id)!;
    }
  };
  return [...keep].sort((a, b) => {
    const x = key(a), y = key(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return c !== 0 ? c : order.get(a.id)! - order.get(b.id)!;
  }).map((r) => r.id);
}

/* ---------- find and go to ---------- */

/** The next cell (after `from`, wrapping round, or before it when `backwards`) whose text contains the query; null when none does. */
export function findCell(input: { rows: ReadonlyArray<SheetRow>; columns: readonly SheetColumn[]; values: ValuesById; query: string; from: Cell; backwards?: boolean; history?: HistoryLookup }): Cell | null {
  const q = fold(input.query.trim());
  if (!q || input.rows.length === 0) return null;
  const cols = input.columns.length;
  const total = input.rows.length * cols;
  const start = input.from.row * cols + input.from.col;
  for (let step = 1; step <= total; step += 1) {
    const at = (((start + (input.backwards ? -step : step)) % total) + total) % total;
    const row = input.rows[Math.floor(at / cols)]!;
    const col = at % cols;
    if (fold(cellText(row, input.columns[col]!.key, input.values[row.id]!, input.history)).includes(q)) return { row: Math.floor(at / cols), col };
  }
  return null;
}

/** "F3" goes to that cell; an indicator code (OUT-12, any case) goes to that row's first typed cell; anything else is null. */
export function goToCell(input: { rows: ReadonlyArray<SheetRow>; columns: readonly SheetColumn[]; text: string }): Cell | null {
  const text = input.text.trim();
  if (!text) return null;
  const ref = /^([A-Za-z]{1,3})(\d{1,5})$/.exec(text);
  const firstTyped = editableBounds(input.columns).first;
  const byCode = input.rows.findIndex((r) => r.code.toLowerCase() === text.toLowerCase());
  if (byCode >= 0) return { row: byCode, col: firstTyped };
  if (ref) {
    let col = 0;
    for (const ch of ref[1]!.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
    const cell = { row: Number(ref[2]) - 1, col: col - 1 };
    if (cell.row >= 0 && cell.row < input.rows.length && cell.col >= 0 && cell.col < input.columns.length) return cell;
  }
  const prefix = input.rows.findIndex((r) => r.code.toLowerCase().startsWith(text.toLowerCase()));
  return prefix >= 0 ? { row: prefix, col: firstTyped } : null;
}

/* ---------- drag the fill handle ---------- */

/**
 * Dragging the fill handle from the selection to `targetRow`: the selection's last row is copied down (or its first row up, when the
 * handle is dragged above it) over the rows it passes, one undo step. Locked rows and read-only columns are skipped.
 */
export function planFillTo(input: { rows: ReadonlyArray<SheetRow>; values: ValuesById; ctx: SheetContext; range: CellRange; targetRow: number; columns?: readonly SheetColumn[] }): { changes: Change[]; skippedLocked: number } {
  const columns = input.columns ?? SHEET_COLUMNS;
  const { range } = input;
  const down = input.targetRow > range.r2;
  const up = input.targetRow < range.r1;
  const out: Change[] = [];
  let skippedLocked = 0;
  if (!down && !up) return { changes: out, skippedLocked };
  const sourceRow = input.rows[down ? range.r2 : range.r1]!;
  const rowsToFill: number[] = [];
  if (down) for (let r = range.r2 + 1; r <= Math.min(input.targetRow, input.rows.length - 1); r += 1) rowsToFill.push(r);
  else for (let r = range.r1 - 1; r >= Math.max(input.targetRow, 0); r -= 1) rowsToFill.push(r);
  const working: ValuesById = { ...input.values };
  for (let c = range.c1; c <= range.c2; c += 1) {
    const column = columns[c];
    if (!column?.editable) continue;
    const key = column.key as EditableColumn;
    const source = working[sourceRow.id]![key];
    for (const r of rowsToFill) {
      const row = input.rows[r]!;
      if (lockReason(row, input.ctx)) { skippedLocked += 1; continue; }
      if (cellProblem(row, key, source) !== null) continue;
      const changes = planEdit(row, key, source, working[row.id]!);
      out.push(...changes);
      working[row.id] = applyChanges({ [row.id]: working[row.id]! }, changes)[row.id]!;
    }
  }
  return { changes: out, skippedLocked };
}

/* ---------- by place: the location breakdown of one indicator as rows ---------- */

export interface PlaceEntry { dimension: string; category: string; value: string }

/** One row per place: the places the breakdown already holds first (in their order), then the known places not yet used, with "" for no value. */
export function placeRows(entries: ReadonlyArray<PlaceEntry>, knownPlaces: ReadonlyArray<string>): Array<{ place: string; value: string }> {
  const mine = entries.filter((e) => e.dimension === "LOCATION");
  const used = new Set(mine.map((e) => fold(e.category)));
  const extra = [...new Set(knownPlaces.map((p) => p.trim()).filter(Boolean))].filter((p) => !used.has(fold(p)));
  return [...mine.map((e) => ({ place: e.category, value: e.value })), ...extra.map((place) => ({ place, value: "" }))];
}

/** The breakdown after setting the places' values: other dimensions are kept as they are; empty values drop the place's entry. */
export function withPlaceValues<E extends PlaceEntry>(entries: ReadonlyArray<E>, rows: ReadonlyArray<{ place: string; value: string }>): E[] {
  const others = entries.filter((e) => e.dimension !== "LOCATION");
  const places = rows.filter((r) => r.place.trim() !== "" && r.value.trim() !== "").map((r) => ({ dimension: "LOCATION", category: r.place.trim(), value: r.value.trim() }) as E);
  return [...others, ...places];
}

/**
 * Pasting "place, value" lines (tab-separated, as copied from Excel) into the place rows: a known place gets its value, an unknown
 * place becomes a new row (named, never guessed), a value that is not a non-negative number is reported and skipped.
 */
export function planPlacePaste(rows: ReadonlyArray<{ place: string; value: string }>, text: string): { rows: Array<{ place: string; value: string }>; added: string[]; problems: string[] } {
  const next = rows.map((r) => ({ ...r }));
  const added: string[] = [];
  const problems: string[] = [];
  for (const line of parseClipboard(text)) {
    const [placeRaw, valueRaw = ""] = line;
    const place = (placeRaw ?? "").trim();
    const value = valueRaw.replace(/[,\s]/g, "");
    if (!place) continue;
    if (value !== "" && !/^\d+(\.\d+)?$/.test(value)) { problems.push(`${place}: "${valueRaw.trim()}" is not a number.`); continue; }
    const hit = next.find((r) => fold(r.place) === fold(place));
    if (hit) hit.value = value;
    else { next.push({ place, value }); added.push(place); }
  }
  return { rows: next, added, problems };
}
