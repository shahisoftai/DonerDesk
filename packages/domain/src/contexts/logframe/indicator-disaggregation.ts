import { DomainError } from "../../core/domain-error.js";
import type { Result } from "../../core/result.js";
import type { IndicatorType } from "./indicator.js";

export type DisaggregationDimension = "SEX" | "AGE_GROUP" | "DISABILITY" | "LOCATION" | "OTHER";

export const DISAGGREGATION_DIMENSIONS: readonly DisaggregationDimension[] = ["SEX", "AGE_GROUP", "DISABILITY", "LOCATION", "OTHER"];

/** One category's value within a dimension (e.g. SEX / Female / 120). Values stay strings like achievements. */
export interface DisaggregationEntry {
  dimension: DisaggregationDimension;
  category: string;
  value: string;
  /**
   * LOCATION (Phase 56): the place this figure is for; the category keeps the name as written; older entries have no id.
   * Any other dimension (Phase 57): the split is *within that place* (e.g. SEX / Female / 12 at Rabak) and adds up to the place's
   * figure. Entries of another dimension without a place id are the project-wide split, as before.
   */
  placeId?: string;
}

/** Project-wide entries (every dimension, plus one figure per place). */
export const MAX_DISAGGREGATION_ENTRIES = 50;
/** Every entry including splits inside places (places × categories). */
export const MAX_BREAKDOWN_ENTRIES = 500;

/** A split inside one place: an entry of a dimension other than LOCATION that names a place. */
export function isPlaceSplit(entry: DisaggregationEntry): boolean {
  return entry.dimension !== "LOCATION" && !!entry.placeId;
}

/** The project-wide breakdown (what every report, chart and export reads): splits inside places left out. */
export function projectWideEntries(entries: readonly DisaggregationEntry[]): DisaggregationEntry[] {
  return entries.filter((e) => !isPlaceSplit(e));
}

/** The splits inside places only. */
export function placeSplitEntries(entries: readonly DisaggregationEntry[]): DisaggregationEntry[] {
  return entries.filter(isPlaceSplit);
}

/** Types whose categories add up to the reported total (a percentage split does not). */
const SUMMABLE_TYPES: ReadonlySet<IndicatorType> = new Set<IndicatorType>(["NUMBER", "CURRENCY"]);

export function disaggregationMustSum(type: IndicatorType): boolean {
  return SUMMABLE_TYPES.has(type);
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Validates a breakdown against its indicator: known dimensions, named
 * categories, numeric values, no duplicate category, and — for summable
 * indicator types with a numeric total — each dimension summing to the total.
 */
export function validateDisaggregation(
  entries: readonly DisaggregationEntry[],
  context: { indicatorType: IndicatorType; periodAchievement: string },
): Result<DisaggregationEntry[], DomainError> {
  if (entries.length > MAX_BREAKDOWN_ENTRIES) {
    return { ok: false, error: DomainError.validation(`At most ${MAX_BREAKDOWN_ENTRIES} breakdown values are allowed`) };
  }
  const wide = projectWideEntries(entries);
  if (wide.length > MAX_DISAGGREGATION_ENTRIES) {
    return { ok: false, error: DomainError.validation(`At most ${MAX_DISAGGREGATION_ENTRIES} breakdown values are allowed`) };
  }
  const splits = placeSplitEntries(entries);
  const checkedWide = validateProjectWide(wide, context);
  if (!checkedWide.ok) return checkedWide;
  if (splits.length === 0) return checkedWide;
  const checkedSplits = validatePlaceSplits(splits, checkedWide.value, context.indicatorType);
  if (!checkedSplits.ok) return checkedSplits;
  return { ok: true, value: [...checkedWide.value, ...checkedSplits.value] };
}

/**
 * Splits inside places: each names a place that has a figure, has a known dimension and a named category, is a number,
 * is not listed twice for its place, and (for a type that adds up) each dimension of a place adds up to that place's figure.
 */
function validatePlaceSplits(
  splits: readonly DisaggregationEntry[],
  wide: readonly DisaggregationEntry[],
  indicatorType: IndicatorType,
): Result<DisaggregationEntry[], DomainError> {
  const placeFigure = new Map(wide.filter((e) => e.dimension === "LOCATION" && e.placeId).map((e) => [e.placeId!, { name: e.category, value: toNumber(e.value) }]));
  const seen = new Set<string>();
  const sums = new Map<string, number>();
  const clean: DisaggregationEntry[] = [];
  for (const entry of splits) {
    if (!DISAGGREGATION_DIMENSIONS.includes(entry.dimension)) {
      return { ok: false, error: DomainError.validation(`Unknown breakdown dimension ${entry.dimension}`) };
    }
    const place = placeFigure.get(entry.placeId!);
    if (!place) return { ok: false, error: DomainError.validation("A split inside a place needs that place's own figure first", { code: "PLACE_SPLIT_WITHOUT_FIGURE" }) };
    const category = entry.category.trim();
    if (!category) return { ok: false, error: DomainError.validation("Every breakdown value needs a category") };
    const key = `${entry.placeId}|${entry.dimension}:${category.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: DomainError.validation(`"${category}" is listed twice for ${place.name}`) };
    seen.add(key);
    const value = entry.value.trim();
    const numeric = toNumber(value);
    if (numeric === null) return { ok: false, error: DomainError.validation(`Breakdown value for "${category}" at ${place.name} must be a number`) };
    const sumKey = `${entry.placeId}|${entry.dimension}`;
    sums.set(sumKey, (sums.get(sumKey) ?? 0) + numeric);
    clean.push({ dimension: entry.dimension, category, value, placeId: entry.placeId! });
  }
  if (disaggregationMustSum(indicatorType)) {
    for (const [sumKey, sum] of sums) {
      const [placeId, dimension] = sumKey.split("|") as [string, DisaggregationDimension];
      const place = placeFigure.get(placeId)!;
      if (place.value !== null && Math.abs(sum - place.value) > 1e-9 * Math.max(1, Math.abs(place.value))) {
        return {
          ok: false,
          error: DomainError.validation(`${dimension} at ${place.name} adds up to ${sum}, but the figure for ${place.name} is ${place.value}`, {
            code: "PLACE_SPLIT_TOTAL_MISMATCH", dimension, placeId, sum, total: place.value,
          }),
        };
      }
    }
  }
  return { ok: true, value: clean };
}

function validateProjectWide(
  entries: readonly DisaggregationEntry[],
  context: { indicatorType: IndicatorType; periodAchievement: string },
): Result<DisaggregationEntry[], DomainError> {
  const seen = new Set<string>();
  const clean: DisaggregationEntry[] = [];
  const sums = new Map<DisaggregationDimension, number>();
  for (const entry of entries) {
    if (!DISAGGREGATION_DIMENSIONS.includes(entry.dimension)) {
      return { ok: false, error: DomainError.validation(`Unknown breakdown dimension ${entry.dimension}`) };
    }
    const category = entry.category.trim();
    if (!category) return { ok: false, error: DomainError.validation("Every breakdown value needs a category") };
    const key = entry.dimension === "LOCATION" && entry.placeId ? `LOCATION:#${entry.placeId}` : `${entry.dimension}:${category.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: DomainError.validation(`"${category}" is listed twice`) };
    seen.add(key);
    const value = entry.value.trim();
    const numeric = toNumber(value);
    if (numeric === null) return { ok: false, error: DomainError.validation(`Breakdown value for "${category}" must be a number`) };
    sums.set(entry.dimension, (sums.get(entry.dimension) ?? 0) + numeric);
    clean.push({ dimension: entry.dimension, category, value, ...(entry.dimension === "LOCATION" && entry.placeId ? { placeId: entry.placeId } : {}) });
  }

  const total = toNumber(context.periodAchievement);
  if (disaggregationMustSum(context.indicatorType) && total !== null) {
    for (const [dimension, sum] of sums) {
      if (Math.abs(sum - total) > 1e-9 * Math.max(1, Math.abs(total))) {
        return {
          ok: false,
          error: DomainError.validation(`${dimension} breakdown adds up to ${sum}, but the period value is ${total}`, {
            code: "DISAGGREGATION_TOTAL_MISMATCH",
            dimension,
            sum,
            total,
          }),
        };
      }
    }
  }
  return { ok: true, value: clean };
}

export function parseDisaggregationJson(json: string | null | undefined): DisaggregationEntry[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is DisaggregationEntry =>
        !!e &&
        typeof e === "object" &&
        DISAGGREGATION_DIMENSIONS.includes((e as DisaggregationEntry).dimension) &&
        typeof (e as DisaggregationEntry).category === "string" &&
        typeof (e as DisaggregationEntry).value === "string",
    ).map((e) => (typeof e.placeId === "string" && e.placeId
      ? { dimension: e.dimension, category: e.category, value: e.value, placeId: e.placeId }
      : { dimension: e.dimension, category: e.category, value: e.value }));
  } catch {
    return [];
  }
}

/**
 * Targets per breakdown (phase 28.1-B): the same rules as reported breakdowns, checked against the indicator's total target.
 * A summable indicator's categories in each dimension must add up to the total target when it is a number.
 */
export function validateTargetBreakdowns(
  entries: readonly DisaggregationEntry[],
  context: { indicatorType: IndicatorType; target: string },
): Result<DisaggregationEntry[], DomainError> {
  return validateDisaggregation(projectWideEntries(entries), { indicatorType: context.indicatorType, periodAchievement: context.target });
}
