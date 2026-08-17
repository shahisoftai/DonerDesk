import type { IndicatorType } from "../logframe/indicator.js";
import type { IndicatorSemantics } from "../logframe/indicator-semantics.js";
import type { FindingQualityFlag, VerifiedFinding } from "./verified-finding.js";
import { buildCalculationMethod } from "./verified-finding.js";

// ---------------------------------------------------------------------------
// Decimal-safe arithmetic. All indicator mathematics uses integer minor-unit
// scaling (bigint) — never raw JavaScript floating point.
// ---------------------------------------------------------------------------

export interface Decimal {
  readonly value: bigint;
  readonly scale: number;
}

const MAX_SCALE = 18;

export function parseDecimal(text: string): Decimal | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const sign = trimmed.startsWith("+") || trimmed.startsWith("-") ? 1 : 0;
  const digits = trimmed.slice(sign);
  const [intPart = "0", fracPart = ""] = digits.split(".");
  const fraction = fracPart.slice(0, MAX_SCALE);
  const scale = fraction.length;
  let value = BigInt(intPart) * 10n ** BigInt(scale) + BigInt(fraction === "" ? 0 : fraction);
  if (negative) value = -value;
  return { value, scale };
}

export function alignDecimals(a: Decimal, b: Decimal): { a: Decimal; b: Decimal; scale: number } {
  const scale = Math.max(a.scale, b.scale);
  const aValue = a.value * 10n ** BigInt(scale - a.scale);
  const bValue = b.value * 10n ** BigInt(scale - b.scale);
  return { a: { value: aValue, scale }, b: { value: bValue, scale }, scale };
}

export function decimalAdd(a: Decimal, b: Decimal): Decimal {
  const aligned = alignDecimals(a, b);
  return { value: aligned.a.value + aligned.b.value, scale: aligned.scale };
}

export function decimalSubtract(a: Decimal, b: Decimal): Decimal {
  const aligned = alignDecimals(a, b);
  return { value: aligned.a.value - aligned.b.value, scale: aligned.scale };
}

export function decimalMultiply(a: Decimal, b: Decimal): Decimal {
  return { value: a.value * b.value, scale: a.scale + b.scale };
}

export function decimalDivide(a: Decimal, b: Decimal, maxScale = 6): Decimal | null {
  if (b.value === 0n) return null;
  const scale = Math.max(0, Math.min(maxScale, MAX_SCALE));
  const dividend = a.value * 10n ** BigInt(scale + b.scale);
  const divisor = b.value * 10n ** BigInt(a.scale);
  const quotient = dividend / divisor;
  return { value: quotient, scale };
}

export function decimalRound(a: Decimal, scale: number): Decimal {
  if (a.scale <= scale) return a;
  const diff = a.scale - scale;
  const factor = 10n ** BigInt(diff);
  const half = factor / 2n;
  const abs = a.value < 0n ? -a.value : a.value;
  const roundedAbs = (abs + half) / factor;
  const rounded = a.value < 0n ? -roundedAbs : roundedAbs;
  return { value: rounded, scale };
}

export function decimalCompare(a: Decimal, b: Decimal): number {
  const aligned = alignDecimals(a, b);
  if (aligned.a.value < aligned.b.value) return -1;
  if (aligned.a.value > aligned.b.value) return 1;
  return 0;
}

export function decimalIsZero(a: Decimal): boolean {
  return a.value === 0n;
}

export function formatDecimal(a: Decimal, maxScale?: number): string {
  let scaled = a;
  if (maxScale !== undefined) scaled = decimalRound(a, maxScale);
  while (scaled.scale > 0 && scaled.value % 10n === 0n) {
    scaled = { value: scaled.value / 10n, scale: scaled.scale - 1 };
  }
  if (scaled.scale === 0) return scaled.value.toString();
  const negative = scaled.value < 0n;
  const abs = negative ? -scaled.value : scaled.value;
  const intPart = abs / 10n ** BigInt(scaled.scale);
  const fracPart = (abs % 10n ** BigInt(scaled.scale)).toString().padStart(scaled.scale, "0");
  return `${negative ? "-" : ""}${intPart.toString()}.${fracPart}`;
}

export function decimalToString(a: Decimal): string {
  return formatDecimal(a);
}

// ---------------------------------------------------------------------------
// Indicator mathematics
// ---------------------------------------------------------------------------

export interface IndicatorUpdateRecord {
  id: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  verificationStatus: string;
  updatedAt: Date;
}

export interface IndicatorCalculationInput {
  indicatorId: string;
  indicatorCode: string;
  indicatorType: IndicatorType;
  unit?: string;
  baseline?: string;
  target?: string;
  semantics: IndicatorSemantics;
  disaggregationRequired: boolean;
  updates: IndicatorUpdateRecord[];
  comparisonPeriodId?: string;
  comparisonPeriodFindingValue?: string;
  /** Verified values of the numerator indicator (PERCENTAGE/RATIO). */
  numeratorValues?: string[];
  /** Verified values of the denominator indicator (PERCENTAGE/RATIO). */
  denominatorValues?: string[];
}

const STALE_MS = 180 * 24 * 60 * 60 * 1000;
const MIN_COVERAGE = 0.5;

function isNumeric(text: string): boolean {
  return parseDecimal(text) !== null;
}

/**
 * Pure, deterministic indicator computation. Produces a VerifiedFinding with
 * the value as a decimal string. Never evaluates performance; it only
 * aggregates and records quality flags.
 */
export function computeIndicator(input: IndicatorCalculationInput): VerifiedFinding {
  const verified = input.updates.filter((u) => u.verificationStatus === "VERIFIED");
  const basis = input.semantics.reportingBasis === "CUMULATIVE" ? "cumulativeAchievement" : "periodAchievement";

  const qualityFlags: FindingQualityFlag[] = [];
  if (input.semantics.status === "REQUIRES_REVIEW") {
    qualityFlags.push("NEEDS_REVIEW");
  }
  if (input.disaggregationRequired) {
    qualityFlags.push("MISSING_DISAGGREGATION");
  }

  const coverage = input.updates.length === 0 ? 0 : verified.length / input.updates.length;
  if (coverage < MIN_COVERAGE) {
    qualityFlags.push("LOW_COVERAGE");
  }

  const staleLatest = verified.reduce<Date | null>((acc, u) => {
    const t = u.updatedAt.getTime();
    return acc === null || t > acc.getTime() ? new Date(t) : acc;
  }, null);
  if (staleLatest !== null && Date.now() - staleLatest.getTime() > STALE_MS) {
    qualityFlags.push("STALE");
  }

  const values = verified
    .map((u) => ({ text: u[basis] as string, id: u.id, updatedAt: u.updatedAt.getTime() }))
    .filter((v) => v.text.trim() !== "");
  const numericValues = values.filter((v) => isNumeric(v.text));

  if (values.length !== numericValues.length) {
    qualityFlags.push("UNIT_MISMATCH");
  }

  let computed: string;

  if (input.semantics.aggregation === "RATIO" || input.semantics.aggregation === "PERCENTAGE") {
    const denominators = (input.denominatorValues ?? []).filter((v) => isNumeric(v));
    if (denominators.length === 0) {
      qualityFlags.push("MISSING_DENOMINATOR");
      computed = "0";
    } else {
      const numeratorSum = (input.numeratorValues ?? []).reduce<Decimal | null>((acc, v) => {
        const d = parseDecimal(v);
        if (!d) return acc;
        return acc === null ? d : decimalAdd(acc, d);
      }, null);
      const denominatorSum = denominators.reduce<Decimal | null>((acc, v) => {
        const d = parseDecimal(v);
        if (!d) return acc;
        return acc === null ? d : decimalAdd(acc, d);
      }, null);
      if (numeratorSum === null || denominatorSum === null) {
        qualityFlags.push("MISSING_DENOMINATOR");
        computed = "0";
      } else {
        const ratio = decimalDivide(numeratorSum, denominatorSum);
        if (ratio === null) {
          qualityFlags.push("MISSING_DENOMINATOR");
          computed = "0";
        } else {
          computed = input.semantics.aggregation === "PERCENTAGE"
            ? formatDecimal(decimalMultiply(ratio, { value: 100n, scale: 0 }), 2)
            : formatDecimal(ratio, 6);
        }
      }
    }
  } else if (numericValues.length === 0) {
    computed = "0";
  } else {
    const decimals = numericValues.map((v) => parseDecimal(v.text) as Decimal);
    switch (input.semantics.aggregation) {
      case "SUM":
        computed = formatDecimal(decimals.reduce((acc, d) => decimalAdd(acc, d)), 6);
        break;
      case "AVERAGE": {
        const sum = decimals.reduce((acc, d) => decimalAdd(acc, d));
        const count: Decimal = { value: BigInt(decimals.length), scale: 0 };
        const average = decimalDivide(sum, count, 6);
        computed = average !== null ? formatDecimal(average, 6) : "0";
        break;
      }
      case "LATEST": {
        const latest = [...numericValues].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        computed = latest ? formatDecimal(parseDecimal(latest.text) as Decimal, 6) : "0";
        break;
      }
      case "MIN": {
        computed = formatDecimal(decimals.reduce((acc, d) => (decimalCompare(d, acc) < 0 ? d : acc)), 6);
        break;
      }
      case "MAX": {
        computed = formatDecimal(decimals.reduce((acc, d) => (decimalCompare(d, acc) > 0 ? d : acc)), 6);
        break;
      }
      default:
        computed = "0";
    }
  }

  const sourceRecordIds = verified.length > 0
    ? verified.map((u) => u.id)
    : input.updates.map((u) => u.id);

  return {
    indicatorId: input.indicatorId,
    indicatorCode: input.indicatorCode,
    value: computed,
    unit: input.unit,
    calculationMethod: buildCalculationMethod(input.semantics.aggregation, input.semantics.direction, input.semantics.reportingBasis),
    reportingPeriodId: "",
    comparisonPeriodId: input.comparisonPeriodId,
    sourceRecordIds,
    qualityFlags: Array.from(new Set(qualityFlags)),
    computedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Direction-aware narrative gating
// ---------------------------------------------------------------------------

export type PerformanceEvaluation =
  | { type: "NEUTRAL"; detail: string }
  | { type: "POSITIVE"; detail: string }
  | { type: "NEGATIVE"; detail: string };

/**
 * Evaluates whether an evaluative statement may be produced for a finding.
 * Unresolved semantics (REQUIRES_REVIEW) and NEUTRAL direction always yield a
 * descriptive-only evaluation; evaluative wording is only permitted when the
 * semantics are CONFIGURED/INFERRED with an explicit direction and a
 * comparison baseline or target exists.
 */
export function evaluatePerformance(input: {
  value: string;
  baseline?: string;
  target?: string;
  semantics: IndicatorSemantics;
}): PerformanceEvaluation {
  if (input.semantics.status === "REQUIRES_REVIEW" || input.semantics.direction === "NEUTRAL") {
    return { type: "NEUTRAL", detail: "Descriptive finding; semantics do not permit evaluative wording" };
  }

  const value = parseDecimal(input.value);
  const baseline = input.baseline ? parseDecimal(input.baseline) : null;
  const target = input.target ? parseDecimal(input.target) : null;
  if (value === null) return { type: "NEUTRAL", detail: "Non-numeric finding; descriptive only" };
  if (baseline === null && target === null) {
    return { type: "NEUTRAL", detail: "No baseline or target for comparison; descriptive only" };
  }

  const reference = target !== null ? target : (baseline as Decimal);
  const comparison = decimalCompare(value, reference);
  const betterWhenHigher = input.semantics.direction === "HIGHER_IS_BETTER";
  const isPositive = betterWhenHigher ? comparison > 0 : comparison < 0;
  const isNegative = betterWhenHigher ? comparison < 0 : comparison > 0;

  if (isPositive) return { type: "POSITIVE", detail: "Value compares favorably against the reference" };
  if (isNegative) return { type: "NEGATIVE", detail: "Value compares unfavorably against the reference" };
  return { type: "NEUTRAL", detail: "Value is in line with the reference" };
}
