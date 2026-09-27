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
}

export const MAX_DISAGGREGATION_ENTRIES = 50;

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
  if (entries.length > MAX_DISAGGREGATION_ENTRIES) {
    return { ok: false, error: DomainError.validation(`At most ${MAX_DISAGGREGATION_ENTRIES} breakdown values are allowed`) };
  }
  const seen = new Set<string>();
  const clean: DisaggregationEntry[] = [];
  const sums = new Map<DisaggregationDimension, number>();
  for (const entry of entries) {
    if (!DISAGGREGATION_DIMENSIONS.includes(entry.dimension)) {
      return { ok: false, error: DomainError.validation(`Unknown breakdown dimension ${entry.dimension}`) };
    }
    const category = entry.category.trim();
    if (!category) return { ok: false, error: DomainError.validation("Every breakdown value needs a category") };
    const key = `${entry.dimension}:${category.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: DomainError.validation(`"${category}" is listed twice`) };
    seen.add(key);
    const value = entry.value.trim();
    const numeric = toNumber(value);
    if (numeric === null) return { ok: false, error: DomainError.validation(`Breakdown value for "${category}" must be a number`) };
    sums.set(entry.dimension, (sums.get(entry.dimension) ?? 0) + numeric);
    clean.push({ dimension: entry.dimension, category, value });
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
    );
  } catch {
    return [];
  }
}
