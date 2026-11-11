/**
 * Filters a viewer applies to a canvas without changing it (Phase 45): up to a period, places, a group (for example "Female") and a
 * plan status. A click on a chart label picks one: the label is matched against what the project actually has, so a click can only
 * mean one thing, and the same label again clears it. Pure.
 */
import type { DataSheet } from "../reporting/data-sheet.js";
import type { DatasetPlanRow } from "../reporting/dataset-query.js";

/** `level` and `indicator` are the drill: a logframe level (Outcome, Output…) narrows to its indicators, and one indicator narrows to itself. */
export interface CrossFilter { periodId: string; places: string[]; group: string; status: string; level: string; indicator: string; donors?: string[] | undefined; partners?: string[] | undefined }
export const NO_FILTER: CrossFilter = { periodId: "", places: [], group: "", status: "", level: "", indicator: "", donors: [], partners: [] };
export interface FilterChoices {
  periods: Array<{ id: string; label: string }>;
  places: Array<{ key: string; label: string }>;
  groups: string[];
  statuses: string[];
  /** The logframe levels the project's indicators sit at, and the indicators themselves (id and code), for the drill. */
  levels: string[];
  indicators: Array<{ id: string; label: string; name: string }>;
  /** The places list as a tree, so a filter can offer provinces then districts (Phase 50.3); absent when it could not be read. */
  placeTree?: Array<{ key: string; label: string; level: number; parentKey: string | null }> | undefined;
  /** Donors and implementing partners of the projects the canvas reads, for the filter bar; never through a share link. */
  donors?: string[] | undefined;
  partners?: string[] | undefined;
}
export const EMPTY_CHOICES: FilterChoices = { periods: [], places: [], groups: [], statuses: [], levels: [], indicators: [] };

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
export const isFiltered = (f: CrossFilter): boolean => Boolean(f.periodId || f.places.length || f.group || f.status || f.level || f.indicator || f.donors?.length || f.partners?.length);

/** What a clicked label means, in a fixed order (period, place, group, status), and the filter that results. An unknown label changes nothing. */
export function pickToFilter(choices: FilterChoices, current: CrossFilter, clicked: string): CrossFilter {
  const wanted = fold(clicked);
  if (!wanted) return current;
  const period = choices.periods.find((p) => fold(p.label) === wanted);
  if (period) return { ...current, periodId: current.periodId === period.id ? "" : period.id };
  const place = choices.places.find((p) => fold(p.label) === wanted || p.key === wanted);
  if (place) return { ...current, places: current.places[0] === place.key ? [] : [place.key] };
  const group = choices.groups.find((g) => fold(g) === wanted);
  if (group) return { ...current, group: fold(current.group) === fold(group) ? "" : group };
  const status = choices.statuses.find((s) => fold(s) === wanted);
  if (status) return { ...current, status: fold(current.status) === fold(status) ? "" : status };
  const level = (choices.levels ?? []).find((l) => fold(l) === wanted);
  if (level) return { ...current, level: fold(current.level) === fold(level) ? "" : level, indicator: "" };
  const indicator = (choices.indicators ?? []).find((i) => i.id === clicked || fold(i.label) === wanted || fold(i.name) === wanted);
  if (indicator) return { ...current, indicator: current.indicator === indicator.id ? "" : indicator.id };
  return current;
}

/** The groups the recorded breakdowns name (every dimension), in the order first seen. */
export function groupsOf(sheet: DataSheet, limit = 30): string[] {
  const seen = new Map<string, string>();
  for (const cell of sheet.cells) for (const b of cell.breakdown ?? []) { if (b.dimension === "LOCATION") continue; const k = fold(b.category); if (k && !seen.has(k)) seen.set(k, b.category); }
  return [...seen.values()].slice(0, limit);
}

/**
 * The sheet as one group sees it: each value is the group's recorded share, and a group nobody recorded is an empty value (never 0).
 * A group has no recorded cumulative figure and no target, so those are left empty rather than invented; places are not groups.
 */
export function restrictSheetToGroup(sheet: DataSheet, group: string): DataSheet {
  const wanted = fold(group);
  if (!wanted) return sheet;
  return {
    ...sheet,
    // A group has no target of its own, so nothing is compared with the project\'s target (a share of it would mislead).
    indicators: sheet.indicators.map((i) => ({ ...i, target: "" })),
    cells: sheet.cells.map((c) => {
      const found = (c.breakdown ?? []).find((b) => b.dimension !== "LOCATION" && fold(b.category) === wanted);
      return { ...c, periodValue: found ? found.value : "", cumulativeValue: "", breakdown: found ? [found] : [] };
    }),
  };
}

/** The planned work with one status (by its plain label or its code). */
export function restrictPlanToStatus<T extends Pick<DatasetPlanRow, "status" | "signalLabel">>(rows: readonly T[], status: string): T[] {
  const wanted = fold(status);
  return wanted ? rows.filter((r) => fold(r.signalLabel) === wanted || fold(r.status) === wanted) : [...rows];
}

/** The distinct plain statuses of the planned work, for the filter's choices. */
export const statusesOf = (rows: ReadonlyArray<Pick<DatasetPlanRow, "signalLabel">>): string[] => [...new Set(rows.map((r) => r.signalLabel).filter(Boolean))];

/** The logframe levels the indicators sit at, in the order first seen (an indicator with no level adds none). */
export function levelsOf(sheet: DataSheet): string[] {
  const seen = new Map<string, string>();
  for (const i of sheet.indicators) { const k = fold(i.level ?? ""); if (k && !seen.has(k)) seen.set(k, i.level as string); }
  return [...seen.values()];
}

/** The indicators a viewer can drill to: id, code and name. */
export const indicatorChoicesOf = (sheet: DataSheet): Array<{ id: string; label: string; name: string }> => sheet.indicators.map((i) => ({ id: i.id, label: i.code, name: i.name }));

const keepIndicators = (sheet: DataSheet, keep: (i: DataSheet["indicators"][number]) => boolean): DataSheet => {
  const ids = new Set(sheet.indicators.filter(keep).map((i) => i.id));
  return { ...sheet, indicators: sheet.indicators.filter((i) => ids.has(i.id)), cells: sheet.cells.filter((c) => ids.has(c.indicatorId)) };
};

/** The sheet as one logframe level sees it: only the indicators at that level, with their own figures and targets (nothing is recomputed). */
export function restrictSheetToLevel(sheet: DataSheet, level: string): DataSheet {
  const wanted = fold(level);
  return wanted ? keepIndicators(sheet, (i) => fold(i.level ?? "") === wanted) : sheet;
}

/** The sheet as one indicator sees it (by id, code or name). */
export function restrictSheetToIndicator(sheet: DataSheet, indicator: string): DataSheet {
  const wanted = fold(indicator);
  return wanted ? keepIndicators(sheet, (i) => i.id === indicator || fold(i.code) === wanted || fold(i.name) === wanted) : sheet;
}

/** Every viewer narrowing that changes the sheet, in the drill's own order: level, then indicator, then group. */
export function restrictSheet(sheet: DataSheet, f: { level?: string | undefined; indicator?: string | undefined; group?: string | undefined }): DataSheet {
  let out = sheet;
  if (f.level) out = restrictSheetToLevel(out, f.level);
  if (f.indicator) out = restrictSheetToIndicator(out, f.indicator);
  if (f.group) out = restrictSheetToGroup(out, f.group);
  return out;
}

/** One step back up the drill: the most specific narrowing is cleared first (group, indicator, level, place, then period). */
export function drillUp(f: CrossFilter): CrossFilter {
  if (f.group) return { ...f, group: "" };
  if (f.indicator) return { ...f, indicator: "" };
  if (f.level) return { ...f, level: "" };
  if (f.places.length) return { ...f, places: [] };
  if (f.periodId) return { ...f, periodId: "" };
  return f;
}
