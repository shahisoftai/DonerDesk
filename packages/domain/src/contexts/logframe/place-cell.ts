/**
 * One place's figure for one indicator in one period (Phase 57: place-first entry and the by-place sheet).
 *
 * A value is stored whole (the total, one LOCATION entry per place, project-wide splits and splits inside places), but a
 * person at one place types only that place's cell. `setPlaceCells` merges cells into the stored breakdown on the server,
 * so two people at two places never overwrite each other. Pure: the handler loads, calls this, and saves through the
 * ordinary bulk save.
 *
 * - The total is never typed here: for a type that adds up it is the sum of the places (no place left = no figure, never 0).
 * - A rate keeps its typed total; its place figures are stored as recorded, never summed.
 * - A cleared cell removes the place's figure and its splits.
 * - The project-wide split of a dimension is derived when every place with a figure carries that split; otherwise a stored
 *   project-wide split is kept only while it still adds up to the new total, and dropped with a notice when it does not.
 */
import type { DisaggregationDimension, DisaggregationEntry } from "./indicator-disaggregation.js";
import { disaggregationMustSum, placeSplitEntries, projectWideEntries } from "./indicator-disaggregation.js";
import type { IndicatorType } from "./indicator.js";

export interface PlaceCellSplit {
  dimension: Exclude<DisaggregationDimension, "LOCATION">;
  category: string;
  value: string;
}

export interface PlaceCell {
  placeId: string;
  /** The place's name, written into the entry's category. */
  placeName: string;
  /** "" clears the place's figure. */
  value: string;
  /** Omitted = keep the place's stored splits when its figure is unchanged, else drop them. [] = clear them. */
  splits?: readonly PlaceCellSplit[] | undefined;
}

export interface PlaceCellsResult {
  /** The total to save; null = keep the stored total (a rate). */
  total: string | null;
  /** The whole breakdown to save (project-wide + splits inside places). */
  entries: DisaggregationEntry[];
  /** Plain sentences: a project-wide split that no longer added up and was dropped. */
  notices: string[];
}

function num(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Written without float noise ("0.30000000000000004" → "0.3"). */
function written(n: number): string {
  return String(Math.round(n * 1e9) / 1e9);
}

/** The stored figure of a place in a breakdown, "" when it has none. */
export function placeCellValue(entries: readonly DisaggregationEntry[], placeId: string): string {
  return entries.find((e) => e.dimension === "LOCATION" && e.placeId === placeId)?.value ?? "";
}

export function setPlaceCells(input: {
  indicatorType: IndicatorType;
  /** The stored breakdown (everything), [] when there is no value yet. */
  stored: readonly DisaggregationEntry[];
  cells: readonly PlaceCell[];
}): PlaceCellsResult {
  const wide = projectWideEntries(input.stored);
  let locations = wide.filter((e) => e.dimension === "LOCATION");
  let splits = placeSplitEntries(input.stored);
  const others = wide.filter((e) => e.dimension !== "LOCATION");

  for (const cell of input.cells) {
    const value = cell.value.trim();
    const before = placeCellValue(locations, cell.placeId);
    locations = locations.filter((e) => e.placeId !== cell.placeId);
    if (value) locations.push({ dimension: "LOCATION", category: cell.placeName, value, placeId: cell.placeId });
    const keepOld = cell.splits === undefined && value !== "" && value === before;
    if (!keepOld) splits = splits.filter((e) => e.placeId !== cell.placeId);
    if (value && cell.splits) {
      for (const s of cell.splits) if (s.value.trim()) splits.push({ dimension: s.dimension, category: s.category.trim(), value: s.value.trim(), placeId: cell.placeId });
    }
  }

  const adds = disaggregationMustSum(input.indicatorType);
  const placeTotals = locations.map((e) => num(e.value)).filter((n): n is number => n !== null);
  const total = adds ? (placeTotals.length ? written(placeTotals.reduce((a, b) => a + b, 0)) : "") : null;

  // Project-wide splits: derived from the places when every place with a figure has one; else kept only while still true.
  const notices: string[] = [];
  const dimensions = new Set<DisaggregationDimension>([...others.map((e) => e.dimension), ...splits.map((e) => e.dimension)]);
  const nextOthers: DisaggregationEntry[] = [];
  for (const dimension of dimensions) {
    const placed = splits.filter((e) => e.dimension === dimension);
    const covered = locations.length > 0 && locations.every((l) => placed.some((s) => s.placeId === l.placeId));
    if (adds && covered) {
      const sums = new Map<string, { category: string; sum: number }>();
      for (const s of placed) {
        const key = s.category.toLowerCase();
        const row = sums.get(key) ?? { category: s.category, sum: 0 };
        row.sum += num(s.value) ?? 0;
        sums.set(key, row);
      }
      for (const { category, sum } of sums.values()) nextOthers.push({ dimension, category, value: written(sum) });
      continue;
    }
    const stored = others.filter((e) => e.dimension === dimension);
    if (!stored.length) continue;
    const sum = stored.reduce((a, e) => a + (num(e.value) ?? 0), 0);
    const target = total === null ? null : num(total);
    if (!adds || target === null || Math.abs(sum - target) <= 1e-9 * Math.max(1, Math.abs(target))) {
      nextOthers.push(...stored);
    } else {
      notices.push(`The ${dimension.toLowerCase().replace(/_/g, " ")} split for the whole project no longer added up to the new total, so it was cleared. Enter it for each place, or again for the project.`);
    }
  }

  return { total, entries: [...nextOthers, ...locations, ...splits], notices };
}
