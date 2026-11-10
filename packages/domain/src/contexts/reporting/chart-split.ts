/**
 * Splitting one indicator by its recorded breakdown (`dataset.splitBy`): each category becomes its own series, so a line or
 * bar chart shows the groups over time and a pie or bar of the latest figures shows how the latest period's value was split.
 * Only what was recorded is drawn: a period whose value carries no split for the dimension is a gap (null), never 0, and no
 * category is ever derived from the total. Categories keep the order they were first recorded in.
 */
import type { ChartSplit, ChartSpecV2 } from "./chart-spec-v2.js";
import type { DatasetPoint, DatasetResult } from "./dataset-query.js";
import type { DataSheetIndicator } from "./data-sheet.js";

/** The breakdown dimensions a chart may be split by. */
export const SPLIT_DIMENSIONS = ["SEX", "AGE_GROUP", "DISABILITY", "LOCATION", "OTHER"] as const;
export type SplitDimension = (typeof SPLIT_DIMENSIONS)[number];

/** Which recorded dimension a split reads: PLACE is always LOCATION; GROUP is the chosen dimension (SEX when none is named). */
export function splitDimensionOf(splitBy: ChartSplit | undefined, dimension: string | undefined): SplitDimension | null {
  if (splitBy === "PLACE") return "LOCATION";
  if (splitBy === "GROUP") return (SPLIT_DIMENSIONS as readonly string[]).includes(dimension ?? "") ? (dimension as SplitDimension) : "SEX";
  return null;
}

/** True when the chart asks for a split this module draws. */
export function isSplitChart(spec: ChartSpecV2): boolean {
  return splitDimensionOf(spec.dataset.splitBy, spec.dataset.splitDimension) !== null;
}

const parse = (v: string): number | null => {
  const n = Number.parseFloat(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * The dataset with the first indicator replaced by one pseudo-indicator per recorded category. The pseudo-indicators carry no
 * baseline or target (a group target is not the indicator's target), so nothing is judged against one.
 */
export function splitDataset(data: DatasetResult, dimension: SplitDimension): DatasetResult | string {
  const indicator = data.indicators[0];
  if (!indicator) return "Choose the indicator to split.";
  if (indicator.isRate && dimension !== "LOCATION") return `${indicator.code} is a rate: its groups cannot be compared as parts of one figure.`;
  const own = data.points.filter((p) => p.indicatorId === indicator.id);
  const categories: string[] = [];
  for (const p of own) for (const b of p.breakdown ?? []) if (b.dimension === dimension && !categories.includes(b.category)) categories.push(b.category);
  if (categories.length === 0) return `No ${dimension === "LOCATION" ? "breakdown by place" : "breakdown by group"} is recorded for ${indicator.code} in these periods.`;

  const idOf = (category: string) => `${indicator.id}::${category}`;
  const indicators: DataSheetIndicator[] = categories.map((category) => ({ ...indicator, id: idOf(category), code: category, name: `${indicator.name}: ${category}`, baseline: "", target: "" }));
  const points: DatasetPoint[] = [];
  let missing = 0;
  for (const p of own) {
    for (const category of categories) {
      const entry = p.value === null ? undefined : (p.breakdown ?? []).find((b) => b.dimension === dimension && b.category === category);
      const value = entry ? parse(entry.value) : null;
      if (p.value !== null && value === null) missing += 1;
      points.push({ indicatorId: idOf(category), periodId: p.periodId, periodLabel: p.periodLabel, value, status: value === null ? "" : p.status, verified: value !== null && p.verified });
    }
  }
  const notes = [...data.notes, `${indicator.code} split by what was recorded for each ${dimension === "LOCATION" ? "place" : "group"}.`];
  if (missing > 0) notes.push(`${missing} ${missing === 1 ? "group has" : "groups have"} no figure recorded in a period that has a total; ${missing === 1 ? "it is" : "they are"} left as a gap.`);
  return { ...data, indicators, points, notes, mixedUnits: false };
}
