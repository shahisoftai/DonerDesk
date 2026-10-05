import type { IndicatorType } from "./indicator.js";
import { inferIndicatorSemantics, type AggregationMethod, type IndicatorSemantics, type PerformanceDirection } from "./indicator-semantics.js";

/**
 * Plain-language description of how an indicator will be aggregated and
 * evaluated. It always describes the *effective* semantics (the configured
 * ones, else the same inference the analytics use), so what a user reads is
 * exactly what a report does.
 */
export interface SemanticsDescription {
  aggregationLabel: string;
  evaluationLabel: string;
  /** One sentence, e.g. "Counts: summed across periods. Not evaluated against the target. Needs review." */
  summary: string;
  needsReview: boolean;
  /** Why it needs review, empty when confirmed. */
  reasons: string[];
}

const AGGREGATION_COPY: Record<AggregationMethod, string> = {
  SUM: "summed across periods",
  AVERAGE: "averaged across periods",
  LATEST: "latest reported value",
  MIN: "lowest value",
  MAX: "highest value",
  RATIO: "calculated as numerator ÷ denominator",
  PERCENTAGE: "calculated as numerator ÷ denominator (%)",
};

const DIRECTION_COPY: Record<PerformanceDirection, string> = {
  HIGHER_IS_BETTER: "Higher is better",
  LOWER_IS_BETTER: "Lower is better",
  NEUTRAL: "Not evaluated against the target",
};

function subjectFor(type: IndicatorType): string {
  switch (type) {
    case "NUMBER":
    case "CURRENCY":
      return "Counts";
    case "PERCENTAGE":
    case "RATIO":
      return "Rate";
    default:
      return "Value";
  }
}

export function describeSemantics(effective: IndicatorSemantics, type: IndicatorType): SemanticsDescription {
  const needsReview = effective.status === "REQUIRES_REVIEW";
  const reasons: string[] = [];
  if (needsReview) {
    reasons.push("The calculation was suggested automatically and has not been confirmed.");
    if (effective.direction === "NEUTRAL") reasons.push("Without a direction the report only describes this indicator; it will not say whether it is on track.");
  }
  const aggregationLabel = AGGREGATION_COPY[effective.aggregation];
  const evaluationLabel = DIRECTION_COPY[effective.direction];
  const parts = [`${subjectFor(type)}: ${aggregationLabel}.`, `${evaluationLabel}.`];
  if (needsReview) parts.push("Needs review.");
  return { aggregationLabel, evaluationLabel, summary: parts.join(" "), needsReview, reasons };
}

/** Effective semantics of an indicator: configured ones, else the shared inference. */
export function effectiveIndicatorSemantics(indicator: {
  type: IndicatorType;
  name: string;
  unit?: string | undefined;
  semantics?: IndicatorSemantics | undefined;
}): IndicatorSemantics {
  return indicator.semantics ?? inferIndicatorSemantics({ type: indicator.type, unit: indicator.unit, name: indicator.name });
}
