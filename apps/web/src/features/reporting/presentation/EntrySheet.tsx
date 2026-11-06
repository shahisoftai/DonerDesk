"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { DisaggregationEntryInput } from "@donordesk/contracts";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { collectionText } from "@/features/tasks/domain/collection-view";
import { DisaggregationEditor } from "@/features/logframe/presentation/DisaggregationEditor";
import { CommentsDisclosure } from "@/features/comments/presentation/CommentsDisclosure";
import { loadValueHistoryAction } from "@/lib/actions/indicators";
import { LOGFRAME_LEVEL_LABEL, INDICATOR_VERIFICATION_LABEL } from "@/lib/labels";
import type { PeriodIndicatorRow, ValueHistoryResponse } from "@/lib/server/schemas";
import { cn } from "@/components/ui/cn";
import { toSheetRow } from "./sheet-rows";
import {
  ROW_FILTERS, ROW_SORTS, ZOOM_MAX, ZOOM_MIN, cellAddress, cellProblem, cellState, cellText, columnLetters, emptyHistory, findCell, goToCell, historyColumns, inRange, lockReason, moveColumn,
  moveSelection, percentOfTarget, placeRows, planClear, planEdit, planFillDown, planFillTo, planNotApplicable, planPaste, planPlacePaste, rangeOf, rangeSize, recordChange, redoStep,
  resizeColumn, resolveColumns, selectionOf, summarise, toClipboardText, toggleColumn, undoStep, viewRowIds, withPlaceValues, defaultSheetPrefs, editableBounds,
  type Cell, type CellState, type Change, type EditableColumn, type History, type RowFilter, type RowSort, type Selection, type SheetColumn, type SheetPrefs, type SheetRow, type SheetValues, type ValuesById,
} from "@/features/reporting/domain/entry-sheet";

export type EntryValues = SheetValues<DisaggregationEntryInput>;

/** Where the automatic save stands, for the status line. The parent runs the save; the sheet only shows it. */
export interface AutosaveStatus { state: "idle" | "pending" | "saving" | "saved" | "queued" | "error" | "failed"; at?: string; message?: string }

const STATE_LABEL: Record<CellState, string> = {
  empty: "sheet.state.empty", unsaved: "sheet.state.unsaved", saved: "sheet.state.saved", submitted: "sheet.state.submitted", returned: "sheet.state.returned",
  verified: "sheet.state.verified", calculated: "sheet.state.calculated", closed: "sheet.state.closed", "read-only": "sheet.state.readOnly",
  "not-applicable": "sheet.state.notApplicable", invalid: "sheet.state.invalid",
};
/** A mark in the cell's corner and a tint: the state is never only a colour (the label is read out too). */
const STATE_MARK: Record<CellState, string> = {
  empty: "", unsaved: "●", saved: "", submitted: "…", returned: "↩", verified: "✓", calculated: "ƒ", closed: "⏸", "read-only": "", "not-applicable": "n/a", invalid: "!",
};
const STATE_TINT: Record<CellState, string> = {
  empty: "", saved: "", unsaved: "bg-amber-50 dark:bg-amber-400/10", submitted: "bg-sky-50 dark:bg-sky-400/10", returned: "bg-orange-50 dark:bg-orange-400/10",
  verified: "bg-emerald-50 text-slate-700 dark:bg-emerald-400/10 dark:text-slate-200", calculated: "bg-slate-100 italic text-slate-600 dark:bg-white/5 dark:text-slate-300",
  closed: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400", "read-only": "bg-slate-50 text-slate-600 dark:bg-white/[0.03] dark:text-slate-300",
  "not-applicable": "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400", invalid: "bg-red-50 dark:bg-red-400/10",
};

const cellId = (c: Cell) => `sheet-cell-${c.row}-${c.col}`;
const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const headerLabel = (c: SheetColumn, t: (k: string) => string): string => (c.labelKey.startsWith("history:") ? c.labelKey.slice("history:".length) : t(c.labelKey));

export interface EntrySheetProps {
  /** Every row, in the framework's order. The sheet filters and sorts them itself. */
  rows: PeriodIndicatorRow[];
  values: Record<string, EntryValues>;
  /** What the server last had for each row, to tell what is unsaved. */
  initial: Record<string, EntryValues>;
  canEdit: boolean;
  /** Set when the entry window is closed to this person right now. */
  closedReason?: string | null;
  today?: string | undefined;
  userId?: string | undefined;
  names?: Record<string, string>;
  canAsk?: boolean;
  projectId: string;
  /** Every change goes through here (typed, pasted, filled, cleared or undone); the parent applies it to its values. */
  onChanges: (changes: Change[]) => void;
  onBreakdown: (rowId: string, entries: DisaggregationEntryInput[]) => void;
  /** What the person chose about columns, density, zoom and saving; kept by the parent, per browser. */
  prefs: SheetPrefs;
  onPrefs: (next: SheetPrefs) => void;
  /** Earlier periods' period values, shown as read-only columns for context. */
  history?: { periods: Array<{ id: string; label: string }>; values: Record<string, Record<string, string>> } | undefined;
  /** Place names the project knows, offered in the by-place table. */
  places?: string[];
  canVerify?: boolean;
  onVerifySelected?: (updateIds: string[]) => void;
  verifying?: boolean;
  autosave: AutosaveStatus;
}

const Btn = ({ onClick, disabled, children, pressed }: { onClick: () => void; disabled?: boolean; children: ReactNode; pressed?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} className={cn("btn-secondary px-2 py-1 text-xs", pressed && "border-brand-600 text-brand-700 dark:text-brand-300")}>{children}</button>
);

/**
 * Indicator values as a spreadsheet: rows and columns always visible, the code and name frozen, a cursor that moves with the arrow
 * keys, typing that edits in place, Excel paste, fill (Ctrl+D or the drag handle), undo and redo, find, go to, filters, sorting,
 * earlier periods, resizable and hideable columns, density and zoom. All behaviour is in `entry-sheet.ts`; this draws it.
 */
export function EntrySheet(props: EntrySheetProps) {
  const { rows, values, initial, canEdit, closedReason, today, userId, names = {}, canAsk = false, projectId, onChanges, onBreakdown, prefs, onPrefs, history, places = [], canVerify = false, onVerifySelected, verifying = false, autosave } = props;
  const { t } = useI18n();
  const ctx = useMemo(() => ({ canEdit, closedReason: closedReason ?? null }), [canEdit, closedReason]);
  const allSheetRows = useMemo(() => rows.map(toSheetRow), [rows]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const [filter, setFilter] = useState<RowFilter>("ALL");
  const [sort, setSort] = useState<RowSort>("LEVEL");
  const [search, setSearch] = useState("");
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const rowsKey = rows.map((r) => r.id).join(",");
  // The shown rows are decided when the filter, sort, search or the set of rows changes, not on every keystroke: a row never jumps away
  // from under the cursor because typing made it "no longer empty".
  const viewIds = useMemo(
    () => viewRowIds({ rows: allSheetRows, values: valuesRef.current as ValuesById, initial: initialRef.current as ValuesById, ctx, filter, sort, search }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsKey, ctx, filter, sort, search],
  );
  const shown = useMemo(() => viewIds.map((id) => rowById.get(id)!).filter(Boolean), [viewIds, rowById]);
  const sheetRows = useMemo(() => shown.map(toSheetRow), [shown]);

  const columns = useMemo(() => resolveColumns(prefs.columns, historyColumns(history?.periods ?? [])), [prefs.columns, history]);
  const historyLookup = useCallback((rowId: string, periodId: string) => history?.values[rowId]?.[periodId] ?? "", [history]);
  const bounds = editableBounds(columns);

  const [sel, setSel] = useState<Selection>(() => selectionOf({ row: 0, col: bounds.first }));
  const [editing, setEditing] = useState<{ cell: Cell; draft: string } | null>(null);
  const [hist, setHist] = useState<History>(emptyHistory);
  const [notice, setNotice] = useState<string[]>([]);
  const [naPrompt, setNaPrompt] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [goOpen, setGoOpen] = useState(false);
  const [goText, setGoText] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [fillTarget, setFillTarget] = useState<number | null>(null);
  const dragging = useRef(false);
  const filling = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  /** The edit in progress, readable by handlers that fire after a state change (blur follows Escape and Enter). */
  const editingRef = useRef<{ cell: Cell; draft: string } | null>(null);
  const setEdit = (next: { cell: Cell; draft: string } | null) => { editingRef.current = next; setEditing(next); };

  const dims = { rows: shown.length, cols: columns.length };
  const range = rangeOf(sel);
  const focus = sel.focus;
  const focusRow = shown[Math.min(focus.row, shown.length - 1)];
  const focusSheetRow = sheetRows[Math.min(focus.row, shown.length - 1)];
  const summary = useMemo(() => summarise(allSheetRows, values as ValuesById, initial as ValuesById, ctx), [allSheetRows, values, initial, ctx]);
  const colLeft = useMemo(() => { const out: number[] = []; let x = 0; for (const c of columns) { out.push(x); x += c.width; } return out; }, [columns]);
  const totalWidth = columns.reduce((n, c) => n + c.width, 0);
  const frozenWidth = columns.filter((c) => c.frozen).reduce((n, c) => n + c.width, 0);
  const pad = prefs.density === "compact" ? "py-0.5" : "py-1.5";

  // The cursor stays inside the rows and columns that exist when the view changes.
  useEffect(() => {
    setSel((s) => {
      const clamp = (c: Cell): Cell => ({ row: Math.max(0, Math.min(c.row, Math.max(0, shown.length - 1))), col: Math.max(0, Math.min(c.col, Math.max(0, columns.length - 1))) });
      const a = clamp(s.anchor), f = clamp(s.focus);
      return sameCell(a, s.anchor) && sameCell(f, s.focus) ? s : { anchor: a, focus: f };
    });
  }, [shown.length, columns.length]);

  useEffect(() => { document.getElementById(cellId(focus))?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [focus]);

  const commit = useCallback((changes: Change[], record = true) => {
    if (changes.length === 0) return;
    onChanges(changes);
    if (record) setHist((h) => recordChange(h, changes));
  }, [onChanges]);
  const refocus = () => container.current?.focus({ preventScroll: true });

  function startEdit(cell: Cell, draft?: string) {
    const row = sheetRows[cell.row];
    const column = columns[cell.col];
    if (!row || !column?.editable || lockReason(row, ctx)) return;
    setEdit({ cell, draft: draft ?? values[row.id]![column.key as EditableColumn] });
  }
  function finishEdit(move?: { key: string; shift?: boolean }) {
    const current = editingRef.current;
    if (!current) return;
    const { cell, draft } = current;
    setEdit(null);
    const row = sheetRows[cell.row]!;
    commit(planEdit(row, columns[cell.col]!.key as EditableColumn, draft, values[row.id]!));
    if (move) setSel((s) => moveSelection(selectionOf(cell), move, dims, columns) ?? s);
    refocus();
  }
  function undo() { const step = undoStep(hist); if (!step) return; setHist(step.history); onChanges(step.apply); }
  function redo() { const step = redoStep(hist); if (!step) return; setHist(step.history); onChanges(step.apply); }
  function fillDown() {
    const { changes, skippedLocked } = planFillDown({ rows: sheetRows, values: values as ValuesById, ctx, range, columns });
    commit(changes);
    setNotice(skippedLocked > 0 ? [t("sheet.paste.locked", { count: skippedLocked })] : []);
  }
  function clearRange(): boolean {
    const plan = planClear({ rows: sheetRows, values: values as ValuesById, initial: initial as ValuesById, ctx, range, columns });
    if (plan.changes.length === 0) return false;
    if (plan.clearsSaved > 0 && !window.confirm(t("sheet.confirmClear", { count: plan.clearsSaved }))) return false;
    commit(plan.changes);
    return true;
  }
  function markNotApplicable(reason: string) {
    commit(planNotApplicable({ rows: sheetRows, values: values as ValuesById, ctx, rowIds: sheetRows.slice(range.r1, range.r2 + 1).map((r) => r.id), reason }));
    setNaPrompt(null);
    refocus();
  }
  function runFind(backwards = false) {
    const hit = findCell({ rows: sheetRows, columns, values: values as ValuesById, query: findText, from: focus, backwards, history: historyLookup });
    if (hit) { setSel(selectionOf(hit)); setNotice([]); } else setNotice([t("sheet.find.none")]);
  }
  function runGoTo() {
    const hit = goToCell({ rows: sheetRows, columns, text: goText });
    if (hit) { setSel(selectionOf(hit)); setGoOpen(false); setNotice([]); refocus(); } else setNotice([t("sheet.find.none")]);
  }

  /** The saved values of the selected rows that can be verified now: handed in or drafted, not yet verified. */
  const selectedUpdateIds = useMemo(
    () => shown.slice(range.r1, range.r2 + 1).filter((r) => r.update && r.update.verificationStatus !== "VERIFIED" && !r.calculation).map((r) => r.update!.id),
    [shown, range.r1, range.r2],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (mod) {
      const k = key.toLowerCase();
      if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === "y") { e.preventDefault(); redo(); return; }
      if (k === "d") { e.preventDefault(); fillDown(); return; }
      if (k === "f") { e.preventDefault(); setFindOpen(true); return; }
      if (k === "g") { e.preventDefault(); setGoOpen(true); return; }
      if (k === "a") { e.preventDefault(); setSel({ anchor: { row: 0, col: 0 }, focus: { row: dims.rows - 1, col: dims.cols - 1 } }); return; }
      if (key.startsWith("Arrow") || key === "Home" || key === "End") {
        const next = moveSelection(sel, { key, shift: e.shiftKey, ctrl: true }, dims, columns);
        if (next) { e.preventDefault(); setSel(next); }
      }
      return;
    }
    if (key === "Delete" || key === "Backspace") { e.preventDefault(); clearRange(); return; }
    const editable = Boolean(columns[focus.col]?.editable) && focusSheetRow !== undefined && !lockReason(focusSheetRow, ctx);
    if (key === "F2" || (key === "Enter" && sameCell(sel.anchor, sel.focus) && editable)) { e.preventDefault(); startEdit(focus); return; }
    if (key === "Escape") { setNotice([]); return; }
    const next = moveSelection(sel, { key, shift: e.shiftKey }, dims, columns);
    if (next) { e.preventDefault(); setSel(next); return; }
    if (key.length === 1 && !e.altKey && editable) { e.preventDefault(); startEdit(focus, key); }
  }

  function onCopy(e: ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    const cells: string[][] = [];
    for (let r = range.r1; r <= range.r2; r += 1) {
      const row = sheetRows[r]!;
      const line: string[] = [];
      for (let c = range.c1; c <= range.c2; c += 1) line.push(cellText(row, columns[c]!.key, values[row.id]!, historyLookup));
      cells.push(line);
    }
    e.clipboardData.setData("text/plain", toClipboardText(cells));
    e.preventDefault();
  }
  function onCut(e: ClipboardEvent<HTMLDivElement>) { if (editing) return; onCopy(e); clearRange(); }
  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    e.preventDefault();
    const plan = planPaste({ rows: sheetRows, values: values as ValuesById, ctx, anchor: { row: range.r1, col: range.c1 }, range: rangeSize(range) > 1 ? range : undefined, text: e.clipboardData.getData("text/plain"), columns });
    commit(plan.changes);
    const lines: string[] = [];
    if (plan.applied > 0) lines.push(t("sheet.paste.applied", { count: plan.applied }));
    if (plan.skippedLocked > 0) lines.push(t("sheet.paste.locked", { count: plan.skippedLocked }));
    if (plan.problems.length > 0) {
      lines.push(t("sheet.paste.invalid", { count: plan.problems.length }));
      for (const p of plan.problems.slice(0, 3)) lines.push(p.message);
    }
    if (plan.overflowRows > 0 || plan.overflowCols > 0) lines.push(t("sheet.paste.overflow"));
    setNotice(lines);
  }

  // The mouse button is released wherever the pointer is: that ends a range drag, a fill drag or a column resize.
  const resize = useRef<{ key: SheetColumn["key"]; startX: number; startWidth: number } | null>(null);
  const finishFillRef = useRef<() => void>(() => undefined);
  finishFillRef.current = () => {
    if (!filling.current) return;
    filling.current = false;
    const target = fillTarget;
    setFillTarget(null);
    if (target === null) return;
    const { changes, skippedLocked } = planFillTo({ rows: sheetRows, values: valuesRef.current as ValuesById, ctx, range, targetRow: target, columns });
    commit(changes);
    if (target > range.r2) setSel((s) => ({ anchor: s.anchor, focus: { row: target, col: s.focus.col } }));
    setNotice(skippedLocked > 0 ? [t("sheet.paste.locked", { count: skippedLocked })] : []);
  };
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => {
    const up = () => { dragging.current = false; resize.current = null; finishFillRef.current(); };
    const move = (e: globalThis.MouseEvent) => {
      const r = resize.current;
      if (r) onPrefs({ ...prefsRef.current, columns: resizeColumn(prefsRef.current.columns, r.key, r.startWidth + e.clientX - r.startX) });
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("mousemove", move); };
  }, [onPrefs]);

  const selectedCell = (r: number, c: number) => inRange(range, { row: r, col: c });
  const inFillZone = (r: number) => fillTarget !== null && (fillTarget > range.r2 ? r > range.r2 && r <= fillTarget : r < range.r1 && r >= fillTarget);
  let lastLevel: string | null | undefined;
  const autosaveText: string | null = (() => {
    switch (autosave.state) {
      case "pending": return t("sheet.autosave.pending");
      case "saving": return t("sheet.autosave.saving");
      case "saved": return t("sheet.autosave.saved", { time: autosave.at ?? "" });
      case "queued": return t("sheet.autosave.queued");
      case "error": return t("sheet.autosave.error");
      case "failed": return t("sheet.autosave.failed", { message: autosave.message ?? "" });
      default: return null;
    }
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs" role="toolbar" aria-label={t("sheet.table")}>
        <Btn onClick={undo} disabled={hist.undo.length === 0}>{t("sheet.undo")}</Btn>
        <Btn onClick={redo} disabled={hist.redo.length === 0}>{t("sheet.redo")}</Btn>
        <Btn onClick={fillDown} disabled={!canEdit || range.r2 <= range.r1}>{t("sheet.fillDown")}</Btn>
        <Btn onClick={() => clearRange()} disabled={!canEdit}>{t("sheet.clear")}</Btn>
        <Btn onClick={() => setNaPrompt("")} disabled={!canEdit}>{t("sheet.notApplicable")}</Btn>
        {canVerify && onVerifySelected && <Btn onClick={() => onVerifySelected(selectedUpdateIds)} disabled={verifying || selectedUpdateIds.length === 0}>{t("sheet.verifySelected", { count: selectedUpdateIds.length })}</Btn>}
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-white/20" aria-hidden="true" />
        <Btn onClick={() => setFindOpen((o) => !o)} pressed={findOpen}>{t("sheet.find")}</Btn>
        <Btn onClick={() => setGoOpen((o) => !o)} pressed={goOpen}>{t("sheet.goTo")}</Btn>
        <label className="flex items-center gap-1">{t("sheet.filter.label")}
          <select value={filter} onChange={(e) => setFilter(e.target.value as RowFilter)} className="input w-auto px-1.5 py-0.5 text-xs">{ROW_FILTERS.map((f) => <option key={f} value={f}>{t(`sheet.filter.${f}`)}</option>)}</select>
        </label>
        <label className="flex items-center gap-1">{t("sheet.sort.label")}
          <select value={sort} onChange={(e) => setSort(e.target.value as RowSort)} className="input w-auto px-1.5 py-0.5 text-xs">{ROW_SORTS.map((s) => <option key={s} value={s}>{t(`sheet.sort.${s}`)}</option>)}</select>
        </label>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("sheet.search")} aria-label={t("sheet.search")} className="input w-40 px-2 py-0.5 text-xs" />
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <Btn onClick={() => setColumnsOpen((o) => !o)} pressed={columnsOpen}>{t("sheet.columns")}</Btn>
          <label className="flex items-center gap-1">{t("sheet.density.label")}
            <select value={prefs.density} onChange={(e) => onPrefs({ ...prefs, density: e.target.value === "compact" ? "compact" : "comfortable" })} className="input w-auto px-1.5 py-0.5 text-xs">
              <option value="comfortable">{t("sheet.density.comfortable")}</option><option value="compact">{t("sheet.density.compact")}</option>
            </select>
          </label>
          <Btn onClick={() => onPrefs({ ...prefs, zoom: Math.max(ZOOM_MIN, Math.round((prefs.zoom - 0.05) * 20) / 20) })} disabled={prefs.zoom <= ZOOM_MIN}>{t("sheet.zoomOut")}</Btn>
          <span aria-live="polite">{t("sheet.zoom", { percent: Math.round(prefs.zoom * 100) })}</span>
          <Btn onClick={() => onPrefs({ ...prefs, zoom: Math.min(ZOOM_MAX, Math.round((prefs.zoom + 0.05) * 20) / 20) })} disabled={prefs.zoom >= ZOOM_MAX}>{t("sheet.zoomIn")}</Btn>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={prefs.showRefs} onChange={(e) => onPrefs({ ...prefs, showRefs: e.target.checked })} />{t("sheet.showRefs")}</label>
          {canEdit && <label className="flex items-center gap-1.5"><input type="checkbox" checked={prefs.autosave} onChange={(e) => onPrefs({ ...prefs, autosave: e.target.checked })} />{t("sheet.autosave.label")}</label>}
        </span>
      </div>

      {findOpen && (
        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); runFind(false); }}>
          <input autoFocus value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setFindOpen(false); refocus(); } }} placeholder={t("sheet.find.placeholder")} aria-label={t("sheet.find.placeholder")} className="input max-w-xs px-2 py-1 text-xs" />
          <button type="submit" className="btn-secondary px-2 py-1 text-xs">{t("sheet.find.next")}</button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => runFind(true)}>{t("sheet.find.prev")}</button>
        </form>
      )}
      {goOpen && (
        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); runGoTo(); }}>
          <input autoFocus value={goText} onChange={(e) => setGoText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setGoOpen(false); refocus(); } }} placeholder={t("sheet.goTo.placeholder")} aria-label={t("sheet.goTo.placeholder")} className="input max-w-xs px-2 py-1 text-xs" />
          <button type="submit" className="btn-secondary px-2 py-1 text-xs">{t("sheet.goTo")}</button>
        </form>
      )}
      {columnsOpen && (
        <section className="rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-white/10 dark:bg-slate-900/60" aria-label={t("sheet.columns")}>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...resolveColumns({ hidden: [], order: prefs.columns.order, widths: {} }, historyColumns(history?.periods ?? []))].map((c) => {
              const shownNow = columns.some((x) => x.key === c.key);
              return (
                <li key={c.key} className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-1.5">
                    <input type="checkbox" checked={shownNow} disabled={c.frozen} onChange={() => onPrefs({ ...prefs, columns: toggleColumn(prefs.columns, c.key) })} />
                    {headerLabel(c, t)}
                  </label>
                  {!c.frozen && shownNow && (
                    <>
                      <button type="button" aria-label={`${t("sheet.columns.left")}: ${headerLabel(c, t)}`} className="px-1" onClick={() => onPrefs({ ...prefs, columns: moveColumn(prefs.columns, columns, c.key, -1) })}>←</button>
                      <button type="button" aria-label={`${t("sheet.columns.right")}: ${headerLabel(c, t)}`} className="px-1" onClick={() => onPrefs({ ...prefs, columns: moveColumn(prefs.columns, columns, c.key, 1) })}>→</button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="mt-2 text-brand-700 underline dark:text-brand-300" onClick={() => onPrefs({ ...defaultSheetPrefs(), density: prefs.density, zoom: prefs.zoom, autosave: prefs.autosave, showRefs: prefs.showRefs })}>{t("sheet.columns.reset")}</button>
        </section>
      )}
      {naPrompt !== null && (
        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); if (naPrompt.trim()) markNotApplicable(naPrompt); }}>
          <label htmlFor="sheet-na-reason" className="font-medium">{t("sheet.naPrompt")}</label>
          <input id="sheet-na-reason" autoFocus value={naPrompt} onChange={(e) => setNaPrompt(e.target.value)} className="input max-w-sm px-2 py-1 text-xs" />
          <button type="submit" className="btn px-2 py-1 text-xs" disabled={!naPrompt.trim()}>{t("sheet.naApply")}</button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => { setNaPrompt(null); refocus(); }}>{t("sheet.cancel")}</button>
        </form>
      )}

      <div
        ref={container}
        role="grid"
        tabIndex={0}
        aria-label={t("sheet.table")}
        aria-rowcount={shown.length + 1}
        aria-colcount={columns.length}
        aria-activedescendant={shown.length > 0 ? cellId(focus) : undefined}
        aria-multiselectable="true"
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        style={{ scrollPaddingLeft: frozenWidth + 8, scrollPaddingTop: 40, zoom: prefs.zoom }}
        className="relative max-h-[70vh] overflow-auto rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/15 dark:bg-slate-900/60"
      >
        <table className="border-separate border-spacing-0" style={{ tableLayout: "fixed", width: totalWidth, minWidth: totalWidth }}>
          <colgroup>{columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead>
            {prefs.showRefs && (
              <tr role="row" aria-hidden="true">
                {columns.map((c, i) => (
                  <th key={c.key} style={c.frozen ? { left: colLeft[i] } : undefined} className={cn("sticky top-0 z-20 border-b border-e border-slate-300 bg-slate-200 px-2 py-0.5 text-center text-[10px] font-normal text-slate-500 dark:border-white/15 dark:bg-slate-800", c.frozen && "z-30")}>{columnLetters(i)}</th>
                ))}
              </tr>
            )}
            <tr role="row" aria-rowindex={1}>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  role="columnheader"
                  scope="col"
                  style={c.frozen ? { left: colLeft[i] } : undefined}
                  className={cn("sticky z-20 border-b border-e border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-slate-800 dark:text-slate-200", prefs.showRefs ? "top-[18px]" : "top-0", c.align === "end" ? "text-end" : "text-start", c.frozen && "z-30")}
                >
                  <span className="block truncate">{headerLabel(c, t)}</span>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("sheet.resize", { name: headerLabel(c, t) })}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); resize.current = { key: c.key, startX: e.clientX, startWidth: c.width }; }}
                    className="absolute end-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-500/40"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => {
              const sRow = sheetRows[r]!;
              const v = values[row.id]!;
              const init = initial[row.id]!;
              const levelChanged = sort === "LEVEL" && row.logframeLevel !== lastLevel;
              if (sort === "LEVEL") lastLevel = row.logframeLevel;
              const percent = percentOfTarget(sRow, v);
              return (
                <RowGroup
                  key={row.id}
                  header={levelChanged ? <tr role="presentation"><td colSpan={columns.length} className="border-b border-slate-200 bg-slate-50 p-0 dark:border-white/10 dark:bg-white/5"><div className="sticky left-0 w-fit px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{row.logframeLevel ? (LOGFRAME_LEVEL_LABEL[row.logframeLevel] ?? row.logframeLevel) : "—"}</div></td></tr> : null}
                >
                  <tr role="row" aria-rowindex={r + 2}>
                    {columns.map((c, i) => {
                      const cell: Cell = { row: r, col: i };
                      const selected = selectedCell(r, i);
                      const isFocus = sameCell(cell, focus);
                      const base = cn(
                        "relative overflow-hidden border-b border-e border-slate-200 px-2 align-middle dark:border-white/10",
                        pad,
                        c.align === "end" ? "text-end" : "text-start",
                        c.frozen && "sticky z-10 bg-white dark:bg-slate-900",
                        selected && "bg-brand-100/70 dark:bg-brand-400/20",
                        isFocus && "outline outline-2 -outline-offset-2 outline-brand-600 dark:outline-brand-300",
                        inFillZone(r) && i >= range.c1 && i <= range.c2 && "outline-dashed outline-1 -outline-offset-1 outline-brand-500",
                      );
                      const pointer = {
                        onMouseDown: (e: MouseEvent) => {
                          if (e.button !== 0) return;
                          if (editing && !sameCell(editing.cell, cell)) finishEdit();
                          setSel((s) => (e.shiftKey ? { anchor: s.anchor, focus: cell } : selectionOf(cell)));
                          dragging.current = true;
                          refocus();
                        },
                        onMouseEnter: () => {
                          if (filling.current) setFillTarget(r);
                          else if (dragging.current) setSel((s) => ({ anchor: s.anchor, focus: cell }));
                        },
                        onDoubleClick: () => startEdit(cell),
                      };
                      if (!c.editable) {
                        return (
                          <td key={c.key} id={cellId(cell)} role="gridcell" aria-colindex={i + 1} aria-readonly="true" aria-selected={selected} style={c.frozen ? { left: colLeft[i] } : undefined} className={base} {...pointer}>
                            {renderReadOnly(c.key, row, sRow, v, percent, t, historyLookup)}
                          </td>
                        );
                      }
                      const column = c.key as EditableColumn;
                      const state = cellState(sRow, column, v, init, ctx);
                      const isEditing = editing !== null && sameCell(editing.cell, cell);
                      const text = v[column];
                      const showHandle = canEdit && r === range.r2 && i === range.c2 && !isEditing && !lockReason(sRow, ctx);
                      return (
                        <td key={c.key} id={cellId(cell)} role="gridcell" aria-colindex={i + 1} aria-readonly={Boolean(lockReason(sRow, ctx))} aria-selected={selected} aria-invalid={state === "invalid"} className={cn(base, "pe-4", STATE_TINT[state])} {...pointer}>
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editing.draft}
                              onChange={(e) => setEdit({ cell, draft: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); finishEdit({ key: "Enter", shift: e.shiftKey }); }
                                else if (e.key === "Tab") { e.preventDefault(); finishEdit({ key: "Tab", shift: e.shiftKey }); }
                                else if (e.key === "Escape") { e.preventDefault(); setEdit(null); refocus(); }
                                e.stopPropagation();
                              }}
                              onBlur={() => finishEdit()}
                              aria-label={`${row.code} ${headerLabel(c, t)}`}
                              className={cn("w-full bg-transparent text-sm outline-none", c.align === "end" && "text-end")}
                            />
                          ) : (
                            <span className="block truncate" title={cellProblem(sRow, column, text) ?? undefined}>
                              {state === "not-applicable" && (column === "periodAchievement" || column === "cumulativeAchievement") ? "" : text}
                              <span className="sr-only">{` — ${t(STATE_LABEL[state])}`}</span>
                            </span>
                          )}
                          {STATE_MARK[state] && !isEditing ? <span aria-hidden="true" title={t(STATE_LABEL[state])} className="pointer-events-none absolute end-1 top-0 text-[9px] leading-4 text-slate-500 dark:text-slate-400">{STATE_MARK[state]}</span> : null}
                          {showHandle ? (
                            <span
                              role="presentation"
                              data-testid="fill-handle"
                              title={t("sheet.fillHandle")}
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); filling.current = true; setFillTarget(r); }}
                              className="absolute bottom-0 end-0 z-10 h-2 w-2 cursor-crosshair border border-white bg-brand-600"
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {summary.unsavedRows > 0 && <span className="font-medium text-brand-700 dark:text-brand-300">{t("sheet.summary.unsaved", { count: summary.unsavedRows })}</span>}
        {summary.invalidCells > 0 && <span className="font-medium text-red-700 dark:text-red-300">{t("sheet.summary.invalid", { count: summary.invalidCells })}</span>}
        {summary.emptyCells > 0 && <span>{t("sheet.summary.empty", { count: summary.emptyCells })}</span>}
        {summary.lockedRows > 0 && <span>{t("sheet.summary.locked", { count: summary.lockedRows })}</span>}
        {autosaveText && <span data-testid="autosave" className={autosave.state === "error" || autosave.state === "failed" ? "font-medium text-red-700 dark:text-red-300" : undefined}>{autosaveText}</span>}
        <span className="ms-auto text-slate-500 dark:text-slate-400">{shown.length > 0 ? `${cellAddress(focus)} · ` : ""}{t("sheet.hint")}</span>
      </div>
      {notice.length > 0 && (
        <ul role="status" className="space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {notice.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
        </ul>
      )}

      {focusRow && focusSheetRow && (
        <RowDetails
          key={focusRow.id}
          row={focusRow}
          sRow={focusSheetRow}
          values={values[focusRow.id]!}
          locked={Boolean(lockReason(focusSheetRow, ctx))}
          today={today}
          userId={userId ?? ""}
          names={names}
          canAsk={canAsk}
          projectId={projectId}
          places={places}
          onChanges={commit}
          onBreakdown={onBreakdown}
        />
      )}
    </div>
  );
}

function RowGroup({ header, children }: { header: ReactNode; children: ReactNode }) {
  return <>{header}{children}</>;
}

type Translate = (k: string, p?: Record<string, string | number>) => string;

function renderReadOnly(key: string, row: PeriodIndicatorRow, sRow: SheetRow, v: EntryValues, percent: number | null, t: Translate, history: (rowId: string, periodId: string) => string) {
  if (key.startsWith("history:")) return <span className="block truncate text-slate-600 dark:text-slate-300">{history(row.id, key.slice("history:".length)) || "—"}</span>;
  switch (key) {
    case "code": return <span className="font-mono text-xs">{row.code}</span>;
    case "name": return <span className="block truncate font-medium" title={row.name}>{row.name}</span>;
    case "baseline": return <span className="block truncate">{row.baseline || "—"}</span>;
    case "target": return <span className="block truncate">{cellText(sRow, "target", v) || "—"}</span>;
    case "previous": return <span className="block truncate text-slate-600 dark:text-slate-300">{row.previous?.cumulativeAchievement || "—"}</span>;
    case "percentOfTarget":
      return (
        <span className="block truncate">
          {percent === null ? "—" : `${percent}%`}
          {row.stoplight && row.stoplight.light !== "NONE" && (
            <span className="ms-1 text-[10px] font-medium" title={row.stoplight.note}>{row.stoplight.light === "MET" ? `✓ ${t("sheet.light.met")}` : `▲ ${t("sheet.light.below")}`}</span>
          )}
          {row.stoplight?.light === "NONE" && <span className="ms-1 text-[10px] text-slate-500" title={row.stoplight.note}>{t("sheet.light.none")}</span>}
        </span>
      );
    case "status": return row.update ? <span className="block truncate text-xs">{INDICATOR_VERIFICATION_LABEL[row.update.verificationStatus] ?? row.update.verificationStatus}</span> : <span className="text-xs text-slate-400">—</span>;
    default: return null;
  }
}

/** What the row under the cursor needs beyond its cells: by place, the breakdown, why it may not apply, history, comments, hints. */
function RowDetails({ row, sRow, values, locked, today, userId, names, canAsk, projectId, places, onChanges, onBreakdown }: {
  row: PeriodIndicatorRow; sRow: SheetRow; values: EntryValues; locked: boolean; today?: string | undefined; userId: string; names: Record<string, string>; canAsk: boolean; projectId: string; places: string[];
  onChanges: (changes: Change[]) => void; onBreakdown: (rowId: string, entries: DisaggregationEntryInput[]) => void;
}) {
  const { t } = useI18n();
  const hasBreakdown = row.disaggregationRequired || values.disaggregation.length > 0;
  const notApplicable = values.notApplicableReason.trim() !== "";
  const due = today ? collectionText(row.collection, today, userId, names) : "";
  const sameAsLast = row.previous && !locked && !notApplicable && values.periodAchievement.trim() === "" ? row.previous.periodAchievement : null;
  const additive = !row.calculation && row.type !== "PERCENTAGE" && row.type !== "RATIO" && row.type !== "YES_NO" && row.type !== "TEXT" && (row.unit ?? "").trim() !== "%";
  const showPlaces = additive && !locked && !notApplicable && (places.length > 0 || values.disaggregation.some((e) => e.dimension === "LOCATION"));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-900/60" aria-label={t("sheet.details", { code: row.code })}>
      <h3 className="text-sm font-semibold"><span className="font-mono text-xs">{row.code}</span> {row.name}</h3>
      {row.logframeTitle && <p className="text-xs text-slate-500 dark:text-slate-400">{row.logframeTitle}</p>}
      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        {row.calculation && <p className="italic">{row.calculation}</p>}
        {row.dueThisPeriod === false && <p>{t("sheet.details.notDue")}</p>}
        {due && (
          <p className={row.collection?.state === "OVERDUE" ? "font-medium text-red-700 dark:text-red-300" : undefined}>
            {due}
            {canAsk && (row.collection?.state === "DUE" || row.collection?.state === "OVERDUE") && <> · <Link className="underline" href={`/projects/${projectId}/indicators/${row.id}`}>{t("sheet.details.ask")}</Link></>}
          </p>
        )}
        {row.participantsHint && <p role="status">{row.participantsHint}</p>}
        {row.update?.reviewNote && row.update.verificationStatus !== "VERIFIED" && <p className="text-amber-700 dark:text-amber-300">{row.update.reviewNote}</p>}
        {row.stoplight && <p>{row.stoplight.note}</p>}
      </div>
      {(sameAsLast !== null || (!locked && !row.calculation)) && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {sameAsLast !== null && (
            <button type="button" className="text-xs text-brand-700 underline dark:text-brand-300" onClick={() => onChanges(planEdit(sRow, "periodAchievement", sameAsLast, values))}>
              {t("sheet.details.sameAsLast", { value: sameAsLast })}
            </button>
          )}
          {!locked && !row.calculation && (
            <label className="flex items-center gap-2 text-xs">
              <span>{t("sheet.details.reason")}</span>
              <input
                className="input max-w-xs px-2 py-1 text-xs"
                value={values.notApplicableReason}
                onChange={(e) => onChanges(planNotApplicable({ rows: [sRow], values: { [row.id]: values }, ctx: { canEdit: true }, rowIds: [row.id], reason: e.target.value }))}
              />
            </label>
          )}
        </div>
      )}
      {showPlaces && <PlaceTable rowCode={row.code} values={values} places={places} total={values.periodAchievement} onBreakdown={(entries) => onBreakdown(row.id, entries)} />}
      {hasBreakdown && !notApplicable && (
        <div className="mt-3">
          <DisaggregationEditor
            entries={values.disaggregation}
            onChange={(entries) => onBreakdown(row.id, entries)}
            disabled={locked}
            total={values.periodAchievement}
            summable={row.breakdownMustSum ?? false}
            targetGroups={row.targetGroups}
            label={t("sheet.details.breakdown", { code: row.code })}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2">
        <ValueHistory updateId={row.update?.id} />
        {row.update ? <div><p className="text-xs font-medium">{t("sheet.comments")}</p><CommentsDisclosure entityType="indicator_update" entityId={row.update.id} /></div> : <p className="text-xs text-slate-500">{t("sheet.comments.save")}</p>}
      </div>
    </section>
  );
}

/** The location breakdown of one indicator as rows of place and value: type, or paste "place, value" lines from Excel. */
function PlaceTable({ rowCode, values, places, total, onBreakdown }: { rowCode: string; values: EntryValues; places: string[]; total: string; onBreakdown: (entries: DisaggregationEntryInput[]) => void }) {
  const { t } = useI18n();
  const [added, setAdded] = useState("");
  const [note, setNote] = useState<string[]>([]);
  const rows = useMemo(() => placeRows(values.disaggregation, places), [values.disaggregation, places]);
  const sum = rows.reduce((n, r) => n + (Number.parseFloat(r.value.replace(/,/g, "")) || 0), 0);
  const totalNumber = Number.parseFloat(total.replace(/,/g, ""));
  const set = (next: Array<{ place: string; value: string }>) => onBreakdown(withPlaceValues(values.disaggregation, next));
  return (
    <details className="mt-3" open={values.disaggregation.some((e) => e.dimension === "LOCATION")}>
      <summary className="cursor-pointer text-xs font-medium">{t("sheet.byPlace")}</summary>
      <div
        className="mt-2 max-w-md"
        onPaste={(e) => {
          e.preventDefault();
          const plan = planPlacePaste(rows, e.clipboardData.getData("text/plain"));
          set(plan.rows);
          setNote([...(plan.added.length > 0 ? [t("sheet.byPlace.pasted", { count: plan.added.length })] : []), ...plan.problems.slice(0, 3)]);
        }}
      >
        <table className="w-full text-xs" aria-label={`${t("sheet.byPlace")} ${rowCode}`}>
          <thead><tr><th className="py-1 text-start font-medium">{t("sheet.byPlace.place")}</th><th className="py-1 text-end font-medium">{t("sheet.byPlace.value")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.place} className="border-t border-slate-100 dark:border-white/5">
                <td className="py-1 pe-2">{r.place}</td>
                <td className="py-1"><input aria-label={`${r.place} ${t("sheet.byPlace.value")}`} value={r.value} inputMode="decimal" onChange={(e) => set(rows.map((x) => (x.place === r.place ? { ...x, value: e.target.value } : x)))} className="input w-24 px-1.5 py-0.5 text-end text-xs" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (added.trim()) { set([...rows, { place: added.trim(), value: "" }]); setAdded(""); } }}>
          <input value={added} onChange={(e) => setAdded(e.target.value)} placeholder={t("sheet.byPlace.add")} aria-label={t("sheet.byPlace.add")} list={`places-${rowCode}`} className="input px-2 py-1 text-xs" />
          <datalist id={`places-${rowCode}`}>{places.map((p) => <option key={p} value={p} />)}</datalist>
        </form>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("sheet.byPlace.paste")}</p>
        {sum > 0 && Number.isFinite(totalNumber) && sum !== totalNumber && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{t("sheet.byPlace.total", { sum, value: totalNumber })}</p>}
        {note.length > 0 && <ul role="status" className="mt-1 text-[11px]">{note.map((n, i) => <li key={`${i}-${n}`}>{n}</li>)}</ul>}
      </div>
    </details>
  );
}

/** Who saved, handed in, verified or returned this value, loaded only when opened. */
function ValueHistory({ updateId }: { updateId: string | undefined }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: "idle" | "loading" | "failed" | "ready"; data?: ValueHistoryResponse }>({ status: "idle" });
  useEffect(() => {
    if (!open || !updateId || state.status !== "idle") return;
    setState({ status: "loading" });
    void loadValueHistoryAction(updateId).then((r) => setState(r.ok ? { status: "ready", data: r.value } : { status: "failed" }));
  }, [open, updateId, state.status]);
  return (
    <details onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-xs font-medium">{t("sheet.history")}</summary>
      <div className="mt-1 text-xs">
        {!updateId ? <p className="text-slate-500">{t("sheet.history.none")}</p>
          : state.status === "loading" ? <p>{t("sheet.history.loading")}</p>
          : state.status === "failed" ? <p className="text-red-700 dark:text-red-300">{t("sheet.history.failed")}</p>
          : state.data && state.data.entries.length === 0 ? <p className="text-slate-500">{t("sheet.history.empty")}</p>
          : <ul className="space-y-0.5">{state.data?.entries.map((h, i) => <li key={`${h.at}-${i}`}><span className="text-slate-500">{h.at.slice(0, 16).replace("T", " ")}</span> {h.by && <strong>{h.by}</strong>} {h.what}{h.change ? ` (${h.change})` : ""}</li>)}</ul>}
      </div>
    </details>
  );
}
