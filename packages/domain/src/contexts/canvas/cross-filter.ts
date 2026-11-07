/**
 * Filters a viewer applies to a canvas without changing it (Phase 45): up to a period, places, a group (for example "Female") and a
 * plan status. A click on a chart label picks one: the label is matched against what the project actually has, so a click can only
 * mean one thing, and the same label again clears it. Pure.
 */
import type { DataSheet } from "../reporting/data-sheet.js";
import type { DatasetPlanRow } from "../reporting/dataset-query.js";

export interface CrossFilter { periodId: string; places: string[]; group: string; status: string }
export const NO_FILTER: CrossFilter = { periodId: "", places: [], group: "", status: "" };
export interface FilterChoices {
  periods: Array<{ id: string; label: string }>;
  places: Array<{ key: string; label: string }>;
  groups: string[];
  statuses: string[];
}
export const EMPTY_CHOICES: FilterChoices = { periods: [], places: [], groups: [], statuses: [] };

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
export const isFiltered = (f: CrossFilter): boolean => Boolean(f.periodId || f.places.length || f.group || f.status);

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
