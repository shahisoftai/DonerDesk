import type { IndicatorSemantics } from "../logframe/indicator-semantics.js";
import { decimalAdd, decimalCompare, decimalDivide, formatDecimal, parseDecimal, type Decimal } from "./indicator-calculator.js";

/**
 * Life-of-project ("cumulative to date") result for one indicator: what a
 * semi-annual, annual or final report states against the project's targets.
 */
export interface LifeOfProjectValue {
  /** Decimal string. */
  value: string;
  /**
   * REPORTED_CUMULATIVE: the cumulative figure a verified update recorded.
   * COMPUTED: aggregated here from verified period achievements.
   */
  basis: "REPORTED_CUMULATIVE" | "COMPUTED";
  /** Distinct reporting periods that contributed. */
  periodsCovered: number;
  /** ISO date (end of the latest contributing period). */
  asOf: string;
}

/** Report types that state progress since the project started. */
export const LIFE_OF_PROJECT_REPORT_TYPES: ReadonlySet<string> = new Set(["SEMI_ANNUAL", "ANNUAL", "FINAL"]);

export interface LifeOfProjectUpdate {
  periodId: string;
  /** End of the reporting period the update belongs to. */
  periodEnd: Date;
  periodAchievement: string;
  cumulativeAchievement: string;
  verificationStatus: string;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const numeric = (text: string): Decimal | null => (text.trim() === "" ? null : parseDecimal(text));

/**
 * Pure, deterministic. Uses only VERIFIED updates. Returns null when the
 * indicator cannot be aggregated across periods from period values alone
 * (ratios and percentages need their numerator and denominator) or when
 * nothing numeric was verified.
 */
export function computeLifeOfProject(semantics: IndicatorSemantics, updates: ReadonlyArray<LifeOfProjectUpdate>): LifeOfProjectValue | null {
  const verified = updates.filter((u) => u.verificationStatus === "VERIFIED");
  if (verified.length === 0) return null;
  if (semantics.aggregation === "RATIO" || semantics.aggregation === "PERCENTAGE") return null;

  const ordered = [...verified].sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime());
  const latest = ordered[ordered.length - 1]!;
  const asOf = isoDay(latest.periodEnd);

  const reported = [...ordered].reverse().find((u) => numeric(u.cumulativeAchievement) !== null);
  // A recorded cumulative is authoritative for totals; it is the headline value for CUMULATIVE-basis indicators.
  if (reported && (semantics.aggregation === "SUM" || semantics.reportingBasis === "CUMULATIVE")) {
    return {
      value: formatDecimal(numeric(reported.cumulativeAchievement)!, 6),
      basis: "REPORTED_CUMULATIVE",
      periodsCovered: new Set(ordered.map((u) => u.periodId)).size,
      asOf: isoDay(reported.periodEnd),
    };
  }

  const withValue = ordered
    .map((u) => ({ u, d: numeric(u.periodAchievement) }))
    .filter((x): x is { u: LifeOfProjectUpdate; d: Decimal } => x.d !== null);
  if (withValue.length === 0) return null;
  const decimals = withValue.map((x) => x.d);

  let computed: Decimal | null;
  switch (semantics.aggregation) {
    case "SUM":
      computed = decimals.reduce((acc, d) => decimalAdd(acc, d));
      break;
    case "AVERAGE":
      computed = decimalDivide(decimals.reduce((acc, d) => decimalAdd(acc, d)), { value: BigInt(decimals.length), scale: 0 }, 6);
      break;
    case "LATEST":
      computed = decimals[decimals.length - 1]!;
      break;
    case "MIN":
      computed = decimals.reduce((acc, d) => (decimalCompare(d, acc) < 0 ? d : acc));
      break;
    case "MAX":
      computed = decimals.reduce((acc, d) => (decimalCompare(d, acc) > 0 ? d : acc));
      break;
    default:
      return null;
  }
  if (computed === null) return null;
  return {
    value: formatDecimal(computed, 6),
    basis: "COMPUTED",
    periodsCovered: new Set(withValue.map((x) => x.u.periodId)).size,
    asOf,
  };
}
