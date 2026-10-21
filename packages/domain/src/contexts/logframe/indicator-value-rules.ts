import { DomainError } from "../../core/domain-error.js";
import type { IndicatorType } from "./indicator.js";

/**
 * Is what was typed a possible value for this indicator? The grid, the single-value API and the data-sheet import each
 * had their own idea (the import refused non-numbers; the other two accepted "450" for a percentage and "abc" for a
 * count). One rule now, applied before anything is saved, so a typing slip is caught where it is made rather than found in
 * a donor report.
 *
 * An empty value is allowed (the grid saves rows with only one of the two values filled). Anything stricter about a
 * *plausible* number (an order-of-magnitude jump from last period) is a judgement for a person, not a rule.
 */
export interface IndicatorValueSubject {
  code: string;
  type: IndicatorType | string;
  unit?: string | undefined;
  baseline?: string | undefined;
  target?: string | undefined;
}

const MAX_MAGNITUDE = 1e15;

function numeric(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!cleaned || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const isPercentage = (subject: IndicatorValueSubject): boolean => subject.type === "PERCENTAGE" || (subject.unit ?? "").trim() === "%";

/** Counts and amounts cannot be negative unless the indicator itself is set up around negative numbers (a change). */
const allowsNegative = (subject: IndicatorValueSubject): boolean => {
  const baseline = numeric(subject.baseline ?? "");
  const target = numeric(subject.target ?? "");
  return (baseline !== null && baseline < 0) || (target !== null && target < 0);
};

/** Returns the reason the value cannot be right, in plain words, or null when it is fine (or empty). */
export function indicatorValueProblem(subject: IndicatorValueSubject, raw: string, which: "period" | "cumulative"): string | null {
  const text = raw.trim();
  if (!text) return null;
  const label = `${subject.code}: the ${which} value "${text.length > 30 ? `${text.slice(0, 30)}…` : text}"`;
  switch (subject.type) {
    case "TEXT":
    case "CUSTOM":
      return null;
    case "YES_NO":
      return /^(yes|no|y|n|true|false|1|0)$/i.test(text) ? null : `${label} should be Yes or No.`;
    case "RATIO": {
      if (numeric(text) !== null) return numeric(text)! < 0 ? `${label} cannot be negative.` : null;
      const parts = text.split(/\s*[:/]\s*/);
      return parts.length === 2 && parts.every((p) => numeric(p) !== null && numeric(p)! >= 0) ? null : `${label} should be a number or a ratio such as 3:2.`;
    }
    default: {
      const percent = isPercentage(subject);
      const value = numeric(percent ? text.replace(/%\s*$/, "") : text);
      if (value === null) return `${label} is not a number.`;
      if (Math.abs(value) > MAX_MAGNITUDE) return `${label} is too large to be right.`;
      if (percent && (value < 0 || value > 100)) return `${label} is not a possible percentage (it must be between 0 and 100).`;
      if (value < 0 && !allowsNegative(subject)) return `${label} is negative, but this indicator counts or measures something that cannot be below zero.`;
      return null;
    }
  }
}

/** Throws a validation error naming the indicator when either value cannot be right. */
export function assertIndicatorValues(subject: IndicatorValueSubject, values: { periodAchievement?: string | undefined; cumulativeAchievement?: string | undefined }): void {
  const problem = indicatorValueProblem(subject, values.periodAchievement ?? "", "period") ?? indicatorValueProblem(subject, values.cumulativeAchievement ?? "", "cumulative");
  if (problem) throw DomainError.validation(problem);
}
