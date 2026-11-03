/**
 * How tall a widget is on a phone (Phase 39.6), in rows. On a wide screen a widget keeps the height it was saved with; below the
 * narrow width everything stacks, and a saved six-row chart would be half a screen of one picture. One row of the table per kind.
 */
export type WidgetHeightKind = "CHART" | "TEXT" | "REPORT" | "KPI" | "METRIC" | "MAP" | "PROJECT_LIST";
export const WIDGET_HEIGHT_KINDS: readonly WidgetHeightKind[] = ["CHART", "TEXT", "REPORT", "KPI", "METRIC", "MAP", "PROJECT_LIST"];

/** `max` caps the saved height; `min` lifts a tiny saved height so the content is readable. */
export const MOBILE_HEIGHT_BY_KIND: Readonly<Record<WidgetHeightKind, { min: number; max: number }>> = {
  KPI: { min: 2, max: 3 }, METRIC: { min: 2, max: 3 }, TEXT: { min: 1, max: 3 },
  CHART: { min: 3, max: 4 }, REPORT: { min: 3, max: 5 }, PROJECT_LIST: { min: 3, max: 5 }, MAP: { min: 4, max: 5 },
};

export function mobileRows(kind: WidgetHeightKind | undefined, savedRows: number): number {
  const rule = MOBILE_HEIGHT_BY_KIND[kind ?? "CHART"];
  return Math.min(rule.max, Math.max(rule.min, savedRows));
}
