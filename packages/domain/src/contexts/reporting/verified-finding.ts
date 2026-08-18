import type { IndicatorType } from "../logframe/indicator.js";
import type { AggregationMethod, IndicatorSemantics, PerformanceDirection } from "../logframe/indicator-semantics.js";

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
 * Direction-aware narrative gating result. Produced deterministically by
 * `evaluatePerformance`; the narrator may only use evaluative wording when
 * the type is POSITIVE/NEGATIVE (i.e. semantics are resolved and a baseline
 * or target exists). NEUTRAL always means descriptive-only.
 */
export type PerformanceEvaluation =
  | { type: "NEUTRAL"; detail: string }
  | { type: "POSITIVE"; detail: string }
  | { type: "NEGATIVE"; detail: string };

/**
 * A verified finding is the sole output of the deterministic indicator
 * analyst. The value is always a decimal string, never a JavaScript float,
 * and every finding traces back to the indicator updates it consumed.
 * Evaluative narrative is derived separately and gated by direction
 * semantics; the finding itself carries no evaluation.
 *
 * The enrichment fields (indicatorName, indicatorType, baseline, target,
 * semantics, comparisonValue, performanceEvaluation) are optional snapshots
 * that let narrators describe progress against targets and period-on-period
 * changes without recomputing anything. They are absent for legacy persisted
 * snapshots and are always populated by the live analyst.
 */
export interface VerifiedFinding {
  indicatorId: string;
  indicatorCode: string;
  /** Human-readable indicator name from the logframe indicator definition. */
  indicatorName?: string;
  /** Indicator type (NUMBER, PERCENTAGE, YES_NO, TEXT, RATIO, CURRENCY, CUSTOM). */
  indicatorType?: IndicatorType;
  /** Baseline and target from the indicator definition (decimal strings). */
  baseline?: string;
  target?: string;
  value: string;
  unit?: string;
  calculationMethod: string;
  /** Resolved semantics snapshot consumed to produce this finding. */
  semantics?: IndicatorSemantics;
  /** Previous-period value for the same indicator, when one exists. */
  comparisonValue?: string;
  /** Deterministic evaluation gating evaluative narrative for this finding. */
  performanceEvaluation?: PerformanceEvaluation;
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
