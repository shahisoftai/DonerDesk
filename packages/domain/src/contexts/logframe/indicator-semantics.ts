import type { IndicatorType } from "./indicator.js";

/**
 * Indicator semantics describe how a single indicator must be aggregated,
 * whether higher or lower is better, and on which basis achievements are
 * reported. Semantics are never silent authorities: legacy rows and unsafe
 * combinations default to conservative values that force descriptive
 * narrative rather than evaluative claims.
 */
export type AggregationMethod = "SUM" | "AVERAGE" | "LATEST" | "MIN" | "MAX" | "RATIO" | "PERCENTAGE";

export const AGGREGATION_METHODS: AggregationMethod[] = [
  "SUM",
  "AVERAGE",
  "LATEST",
  "MIN",
  "MAX",
  "RATIO",
  "PERCENTAGE",
];

export type PerformanceDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";

export const PERFORMANCE_DIRECTIONS: PerformanceDirection[] = [
  "HIGHER_IS_BETTER",
  "LOWER_IS_BETTER",
  "NEUTRAL",
];

export type SemanticsStatus = "CONFIGURED" | "INFERRED" | "REQUIRES_REVIEW";

export const SEMANTICS_STATUSES: SemanticsStatus[] = ["CONFIGURED", "INFERRED", "REQUIRES_REVIEW"];

export interface IndicatorSemantics {
  aggregation: AggregationMethod;
  direction: PerformanceDirection;
  reportingBasis: "PERIOD" | "CUMULATIVE";
  scale?: number;
  numeratorIndicatorId?: string;
  denominatorIndicatorId?: string;
  status: SemanticsStatus;
}

export function defaultSemanticsForType(type: IndicatorType): IndicatorSemantics {
  switch (type) {
    case "NUMBER":
    case "CURRENCY":
      // Sum is a safe aggregation default for counts and monetary totals.
      // Direction is deliberately neutral: mortality, incidence, complaints,
      // response time, and cost overruns are lower-is-better.
      return { aggregation: "SUM", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" };
    case "PERCENTAGE":
      // Percentages often require weighted aggregation through explicit
      // numerators/denominators; plain averaging is unsafe.
      return { aggregation: "PERCENTAGE", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" };
    case "RATIO":
      return { aggregation: "RATIO", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" };
    case "YES_NO":
    case "TEXT":
    case "CUSTOM":
      // Qualitative indicators are reported as-is; LATEST is the only
      // aggregation that does not invent mathematics.
      return { aggregation: "LATEST", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" };
    default:
      return { aggregation: "LATEST", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" };
  }
}

/**
 * Silent inference from type, unit, and name. Inference never claims a
 * direction: direction is only ever CONFIGURED explicitly or left NEUTRAL.
 * Aggregations that are safe for the type are promoted to INFERRED; anything
 * ambiguous stays REQUIRES_REVIEW.
 */
export function inferIndicatorSemantics(input: {
  type: IndicatorType;
  unit?: string;
  name: string;
  numeratorIndicatorId?: string;
  denominatorIndicatorId?: string;
}): IndicatorSemantics {
  const base = defaultSemanticsForType(input.type);
  const lowerName = input.name.toLowerCase();

  const hasNumerator = Boolean(input.numeratorIndicatorId);
  const hasDenominator = Boolean(input.denominatorIndicatorId);

  if (input.type === "PERCENTAGE") {
    if (hasNumerator && hasDenominator) {
      return { ...base, status: "INFERRED" };
    }
    return base;
  }

  if (input.type === "RATIO") {
    if (hasNumerator && hasDenominator) {
      return { ...base, status: "INFERRED" };
    }
    return base;
  }

  if (input.type === "NUMBER" || input.type === "CURRENCY") {
    const definitelySummable = /(number|count|total|sum|beneficiaries|people|individuals|participants|households|trained|constructed|distributed|reached|enrolled|attended|visits?|sessions?|trees?|latrines?|boreholes?)/.test(lowerName);
    if (definitelySummable) {
      return { ...base, aggregation: "SUM", status: "INFERRED" };
    }
    return base;
  }

  return base;
}

/**
 * Validates a configured semantics object, rejecting unknown aggregation
 * methods, directions, statuses, scales, and ratio/percentage configurations
 * that reference a numerator without a denominator.
 */
export function sanitizeIndicatorSemantics(input: IndicatorSemantics): IndicatorSemantics {
  if (!AGGREGATION_METHODS.includes(input.aggregation)) {
    throw new Error("Invalid aggregation method");
  }
  if (!PERFORMANCE_DIRECTIONS.includes(input.direction)) {
    throw new Error("Invalid performance direction");
  }
  if (input.reportingBasis !== "PERIOD" && input.reportingBasis !== "CUMULATIVE") {
    throw new Error("Invalid reporting basis");
  }
  if (!SEMANTICS_STATUSES.includes(input.status)) {
    throw new Error("Invalid semantics status");
  }
  if (input.scale !== undefined && (!Number.isInteger(input.scale) || input.scale < 0 || input.scale > 18)) {
    throw new Error("Scale must be an integer between 0 and 18");
  }
  if ((input.aggregation === "RATIO" || input.aggregation === "PERCENTAGE")) {
    if (!input.numeratorIndicatorId || !input.denominatorIndicatorId) {
      throw new Error(`${input.aggregation} aggregation requires both numerator and denominator indicators`);
    }
    if (input.numeratorIndicatorId === input.denominatorIndicatorId) {
      throw new Error("Numerator and denominator must be different indicators");
    }
  }
  return input;
}
