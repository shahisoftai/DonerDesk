/**
 * Place-first entry and the by-place sheet (Phase 57). Pure, browser-safe (no node: imports).
 *
 * `placeAgenda`: pick a place and a period, see what is due there — the planned activities at that place (or a place inside it)
 * that are still open in the period, and the indicators measured at that place with the cell's current figure and state.
 * `placeSheet`: one period, rows = places, columns = indicators measured by place (the DevResults layout).
 *
 * The rows of an indicator are `entryRows` (Phase 56), so place-first, the by-place sheet and the indicator form always agree
 * on where an indicator is measured. A missing figure is "", never 0; a place an indicator is not measured at is NOT_MEASURED_HERE.
 */
import type { DisaggregationEntry } from "../logframe/indicator-disaggregation.js";
import { disaggregationMustSum, placeSplitEntries } from "../logframe/indicator-disaggregation.js";
import type { IndicatorType } from "../logframe/indicator.js";
import { placeCellValue } from "../logframe/place-cell.js";
import { entryRows, placeOfEntry, type EntryRow, type IndicatorPlaceSetting } from "./indicator-places.js";
import type { PlaceTree } from "./place-tree.js";
import type { ProjectAreaRecord } from "./footprint.js";

export type CellState = "EMPTY" | "DRAFT" | "HANDED_IN" | "RETURNED" | "VERIFIED";
/** Why a cell cannot be typed into. */
export type CellLock = "VERIFIED" | "CALCULATED" | "PERIOD_LOCKED" | "NOT_APPLICABLE";

export interface AgendaIndicator {
  id: string;
  code: string;
  name: string;
  type: IndicatorType;
  unit?: string | null | undefined;
  setting: IndicatorPlaceSetting;
  calculated?: boolean | undefined;
  /** Whether a figure is expected this period (`isDueInPeriod`, computed by the caller). */
  due: boolean;
}

export interface AgendaValue {
  indicatorId: string;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "NEEDS_CORRECTION" | "REJECTED";
  notApplicable?: boolean | undefined;
  /** The whole stored breakdown (project-wide + splits inside places). */
  breakdown: readonly DisaggregationEntry[];
}

export interface AgendaPlanItem {
  id: string;
  title: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
  placeIds: readonly string[];
}

export interface PlaceCellView {
  indicatorId: string;
  code: string;
  name: string;
  type: IndicatorType;
  unit?: string | null | undefined;
  value: string;
  splits: Array<{ dimension: string; category: string; value: string }>;
  state: CellState;
  lock: CellLock | null;
  /** True when the place's figures make the total (counts, money); a rate is stored as recorded. */
  adds: boolean;
  due: boolean;
}

export interface PlaceAgenda {
  placeId: string;
  activities: AgendaPlanItem[];
  cells: PlaceCellView[];
}

const OPEN_PLAN = new Set(["PLANNED", "IN_PROGRESS"]);

function stateOf(value: AgendaValue | undefined, cell: string): CellState {
  if (!value || cell === "") return "EMPTY";
  if (value.status === "VERIFIED") return "VERIFIED";
  if (value.status === "SUBMITTED") return "HANDED_IN";
  if (value.status === "NEEDS_CORRECTION" || value.status === "REJECTED") return "RETURNED";
  return "DRAFT";
}

function lockOf(indicator: AgendaIndicator, value: AgendaValue | undefined, periodLocked: boolean): CellLock | null {
  if (periodLocked) return "PERIOD_LOCKED";
  if (indicator.calculated) return "CALCULATED";
  if (value?.status === "VERIFIED") return "VERIFIED";
  if (value?.notApplicable) return "NOT_APPLICABLE";
  return null;
}

/** The place ids that hold a figure in a stored breakdown (ids, or a unique name among the candidates). */
function placesWithFigures(breakdown: readonly DisaggregationEntry[], tree: PlaceTree, candidates: readonly string[]): string[] {
  return breakdown.map((e) => placeOfEntry(e, tree, candidates)).filter((id): id is string => !!id);
}

/** The cell of one indicator at one place. Older name-only entries are read by a unique match. */
export function placeCell(indicator: AgendaIndicator, value: AgendaValue | undefined, placeId: string, tree: PlaceTree, candidates: readonly string[], periodLocked: boolean): PlaceCellView {
  const breakdown = value?.breakdown ?? [];
  const byId = placeCellValue(breakdown, placeId);
  const legacy = byId ? "" : breakdown.find((e) => e.dimension === "LOCATION" && !e.placeId && placeOfEntry(e, tree, candidates) === placeId)?.value ?? "";
  const cell = byId || legacy;
  return {
    indicatorId: indicator.id, code: indicator.code, name: indicator.name, type: indicator.type, unit: indicator.unit,
    value: cell,
    splits: placeSplitEntries(breakdown).filter((s) => s.placeId === placeId).map((s) => ({ dimension: s.dimension, category: s.category, value: s.value })),
    state: stateOf(value, cell),
    lock: lockOf(indicator, value, periodLocked),
    adds: disaggregationMustSum(indicator.type),
    due: indicator.due,
  };
}

function rowsOf(indicator: AgendaIndicator, value: AgendaValue | undefined, areas: readonly ProjectAreaRecord[], tree: PlaceTree): EntryRow[] {
  if (indicator.setting.scope === "PROJECT") return [];
  const first = entryRows(indicator.setting, areas, tree);
  const candidates = first.map((r) => r.placeId);
  return entryRows(indicator.setting, areas, tree, placesWithFigures(value?.breakdown ?? [], tree, candidates));
}

export function placeAgenda(input: {
  placeId: string;
  period: { start: string; end: string };
  periodLocked?: boolean | undefined;
  indicators: readonly AgendaIndicator[];
  values: readonly AgendaValue[];
  plan: readonly AgendaPlanItem[];
  areas: readonly ProjectAreaRecord[];
  tree: PlaceTree;
}): PlaceAgenda {
  const { tree } = input;
  const placeId = tree.current(input.placeId) ?? input.placeId;
  const inside = new Set([placeId, ...tree.descendants(placeId)]);
  const activities = input.plan
    .filter((p) => OPEN_PLAN.has(p.status) && p.plannedStart <= input.period.end && p.plannedEnd >= input.period.start)
    .filter((p) => p.placeIds.some((id) => inside.has(tree.current(id) ?? id)))
    .sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd) || a.title.localeCompare(b.title));
  const valueOf = new Map(input.values.map((v) => [v.indicatorId, v]));
  const cells: PlaceCellView[] = [];
  for (const indicator of input.indicators) {
    const value = valueOf.get(indicator.id);
    const rows = rowsOf(indicator, value, input.areas, tree);
    if (!rows.some((r) => r.placeId === placeId)) continue;
    cells.push(placeCell(indicator, value, placeId, tree, rows.map((r) => r.placeId), input.periodLocked ?? false));
  }
  // Due first, then empty first, then by code: what still needs doing is at the top.
  cells.sort((a, b) => Number(b.due) - Number(a.due) || Number(a.value !== "") - Number(b.value !== "") || a.code.localeCompare(b.code, undefined, { numeric: true }));
  return { placeId, activities, cells };
}

/** The places a person can start from: the project's open areas and every live place inside them, by path. */
export function agendaPlaces(areas: readonly ProjectAreaRecord[], tree: PlaceTree, extra: readonly string[] = []): EntryRow[] {
  const ids = new Set<string>();
  for (const a of areas) {
    if (a.closedAt) continue;
    const id = tree.current(a.placeId);
    if (!id || !tree.isLive(id)) continue;
    ids.add(id);
    for (const d of tree.descendants(id)) if (tree.isLive(d)) ids.add(d);
  }
  for (const raw of extra) { const id = tree.current(raw); if (id && tree.isLive(id)) ids.add(id); }
  return [...ids].map((id) => ({ placeId: id, name: tree.get(id)!.name, path: tree.path(id) })).sort((a, b) => a.path.localeCompare(b.path));
}

export const NOT_MEASURED_HERE = "NOT_MEASURED_HERE" as const;

export interface PlaceSheetColumn { indicatorId: string; code: string; name: string; type: IndicatorType; unit?: string | null | undefined; adds: boolean; lock: CellLock | null; due: boolean }
export interface PlaceSheetRow { placeId: string; name: string; path: string; level: number }
export type PlaceSheetCell = { value: string; state: CellState; splits: PlaceCellView["splits"] } | typeof NOT_MEASURED_HERE;

export interface PlaceSheet {
  columns: PlaceSheetColumn[];
  rows: PlaceSheetRow[];
  /** cells[rowIndex][columnIndex] */
  cells: PlaceSheetCell[][];
  /** Per column: the sum of the places for a type that adds up ("" when none recorded), null for a rate. */
  totals: Array<string | null>;
}

/** One period, rows = places, columns = indicators measured by place. Rows are sorted by place path. */
export function placeSheet(input: {
  periodLocked?: boolean | undefined;
  indicators: readonly AgendaIndicator[];
  values: readonly AgendaValue[];
  areas: readonly ProjectAreaRecord[];
  tree: PlaceTree;
}): PlaceSheet {
  const { tree } = input;
  const valueOf = new Map(input.values.map((v) => [v.indicatorId, v]));
  const byPlace = input.indicators.filter((i) => i.setting.scope !== "PROJECT");
  const rowsOfColumn = byPlace.map((i) => rowsOf(i, valueOf.get(i.id), input.areas, tree));
  const rowIds = new Map<string, EntryRow>();
  for (const rows of rowsOfColumn) for (const r of rows) rowIds.set(r.placeId, r);
  const rows: PlaceSheetRow[] = [...rowIds.values()]
    .map((r) => ({ placeId: r.placeId, name: r.name, path: r.path, level: tree.get(r.placeId)?.adminLevel ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const columns: PlaceSheetColumn[] = byPlace.map((i) => {
    const value = valueOf.get(i.id);
    return { indicatorId: i.id, code: i.code, name: i.name, type: i.type, unit: i.unit, adds: disaggregationMustSum(i.type), lock: lockOf(i, value, input.periodLocked ?? false), due: i.due };
  });
  const cells: PlaceSheetCell[][] = rows.map((row) => byPlace.map((indicator, c) => {
    const measured = rowsOfColumn[c]!.some((r) => r.placeId === row.placeId);
    if (!measured) return NOT_MEASURED_HERE;
    const view = placeCell(indicator, valueOf.get(indicator.id), row.placeId, tree, rowsOfColumn[c]!.map((r) => r.placeId), input.periodLocked ?? false);
    return { value: view.value, state: view.state, splits: view.splits };
  }));
  const totals = columns.map((col, c) => {
    if (!col.adds) return null;
    const figures = cells.map((r) => r[c]).filter((x): x is Exclude<PlaceSheetCell, typeof NOT_MEASURED_HERE> => x !== undefined && x !== NOT_MEASURED_HERE && x.value !== "").map((x) => Number(x.value.replace(/[,\s]/g, ""))).filter(Number.isFinite);
    return figures.length ? String(Math.round(figures.reduce((a, b) => a + b, 0) * 1e9) / 1e9) : "";
  });
  return { columns, rows, cells, totals };
}

/** A typed change to a sheet: the cells whose text differs from what is stored (locked and not-measured cells never change). */
export interface PlaceSheetEdit { placeId: string; indicatorId: string; value: string }

export function placeSheetDiff(sheet: PlaceSheet, typed: ReadonlyMap<string, string>): PlaceSheetEdit[] {
  const edits: PlaceSheetEdit[] = [];
  sheet.rows.forEach((row, r) => sheet.columns.forEach((col, c) => {
    const key = `${row.placeId}|${col.indicatorId}`;
    if (!typed.has(key) || col.lock) return;
    const cell = sheet.cells[r]![c]!;
    if (cell === NOT_MEASURED_HERE) return;
    const next = typed.get(key)!.trim();
    if (next !== cell.value) edits.push({ placeId: row.placeId, indicatorId: col.indicatorId, value: next });
  }));
  return edits;
}
