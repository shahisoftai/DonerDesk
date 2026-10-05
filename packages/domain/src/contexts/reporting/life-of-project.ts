import type { IndicatorSemantics } from "../logframe/indicator-semantics.js";
import type { DisaggregationEntry } from "../logframe/indicator-disaggregation.js";
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
  /**
   * Recorded breakdown (sex, age, ...) of THIS value: categories added across the contributing periods for a
   * SUM indicator, the latest period's otherwise. A finding's own `disaggregation` describes only its current
   * period, so a roll-up report must quote this one beside the life-of-project total.
   */
  disaggregation?: DisaggregationEntry[];
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
  /** Recorded breakdown of this update, when there is one. */
  disaggregation?: DisaggregationEntry[];
}

/** SUM indicators add each category across the verified updates; any other aggregation takes the latest update's. */
function lifeBreakdown(ordered: ReadonlyArray<LifeOfProjectUpdate>, aggregation: IndicatorSemantics["aggregation"]): DisaggregationEntry[] {
  const withEntries = ordered.filter((u) => (u.disaggregation ?? []).length > 0);
  if (withEntries.length === 0) return [];
  if (aggregation !== "SUM") return (withEntries[withEntries.length - 1]!.disaggregation ?? []).map((e) => ({ ...e }));
  const totals = new Map<string, { entry: DisaggregationEntry; sum: Decimal }>();
  for (const update of withEntries) {
    for (const entry of update.disaggregation ?? []) {
      const value = parseDecimal(entry.value);
      if (!value) continue;
      const key = `${entry.dimension}:${entry.category.toLowerCase()}`;
      const existing = totals.get(key);
      totals.set(key, { entry: existing?.entry ?? { dimension: entry.dimension, category: entry.category, value: "" }, sum: existing ? decimalAdd(existing.sum, value) : value });
    }
  }
  return [...totals.values()].map(({ entry, sum }) => ({ ...entry, value: formatDecimal(sum, 6) }));
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

  const breakdown = lifeBreakdown(ordered, semantics.aggregation);
  const withBreakdown = breakdown.length > 0 ? { disaggregation: breakdown } : {};
  const reported = [...ordered].reverse().find((u) => numeric(u.cumulativeAchievement) !== null);
  // A recorded cumulative is authoritative for totals; it is the headline value for CUMULATIVE-basis indicators.
  if (reported && (semantics.aggregation === "SUM" || semantics.reportingBasis === "CUMULATIVE")) {
    return {
      value: formatDecimal(numeric(reported.cumulativeAchievement)!, 6),
      basis: "REPORTED_CUMULATIVE",
      periodsCovered: new Set(ordered.map((u) => u.periodId)).size,
      asOf: isoDay(reported.periodEnd),
      ...withBreakdown,
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
    ...withBreakdown,
  };
}
