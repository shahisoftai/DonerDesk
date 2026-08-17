import type { AggregationMethod, PerformanceDirection } from "../logframe/indicator-semantics.js";

export type FindingQualityFlag =
  | "LOW_COVERAGE"
  | "MISSING_DENOMINATOR"
  | "MISSING_DISAGGREGATION"
  | "STALE"
  | "UNIT_MISMATCH"
  | "NEEDS_REVIEW";

export const FINDING_QUALITY_FLAGS: FindingQualityFlag[] = [
  "LOW_COVERAGE",
  "MISSING_DENOMINATOR",
  "MISSING_DISAGGREGATION",
  "STALE",
  "UNIT_MISMATCH",
  "NEEDS_REVIEW",
];

/**
 * A verified finding is the sole output of the deterministic indicator
 * analyst. The value is always a decimal string, never a JavaScript float,
 * and every finding traces back to the indicator updates it consumed.
 * Evaluative narrative is derived separately and gated by direction
 * semantics; the finding itself carries no evaluation.
 */
export interface VerifiedFinding {
  indicatorId: string;
  indicatorCode: string;
  value: string;
  unit?: string;
  calculationMethod: string;
  reportingPeriodId: string;
  comparisonPeriodId?: string;
  sourceRecordIds: string[];
  qualityFlags: FindingQualityFlag[];
  computedAt: Date;
}

export function buildCalculationMethod(
  aggregation: AggregationMethod,
  direction: PerformanceDirection,
  reportingBasis: "PERIOD" | "CUMULATIVE",
): string {
  return `${aggregation}:${direction.toLowerCase().replace(/_/g, "-")}:${reportingBasis.toLowerCase()}`;
}
