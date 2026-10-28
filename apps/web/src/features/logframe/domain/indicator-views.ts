import { kindsForTemplate, type ChartKind, type ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";

/** The ways an indicator's page shows its figures (Phase 34.5). Each is an ordinary chart specification, so the Chart Studio can open and refine it. */
export const INDICATOR_VIEWS = ["TARGET", "OVER_TIME", "BY_PLACE", "BY_GROUP", "TABLE"] as const;
export type IndicatorView = (typeof INDICATOR_VIEWS)[number];

const PLAN: Record<IndicatorView, { template: ChartSpecV2["dataset"]["template"]; prefer: ChartKind[]; placeLevel?: number }> = {
  TARGET: { template: "INDICATOR_VS_TARGET", prefer: ["BAR", "COLUMN", "BULLET"] as ChartKind[] },
  OVER_TIME: { template: "INDICATOR_OVER_TIME", prefer: ["LINE", "BAR", "AREA"] as ChartKind[] },
  BY_PLACE: { template: "RESULTS_BY_PLACE", prefer: ["GRADUATED_SYMBOLS", "BAR"] as ChartKind[], placeLevel: 1 },
  BY_GROUP: { template: "INDICATOR_OVER_TIME", prefer: [] as ChartKind[] },
  TABLE: { template: "INDICATOR_OVER_TIME", prefer: ["PIVOT_TABLE"] as ChartKind[] },
};

/** The specification for one view of one indicator, or null when no chart kind fits the data it needs. Draft values are drawn and counted, as everywhere. */
export function indicatorViewSpec(view: IndicatorView, indicatorId: string): ChartSpecV2 | null {
  if (view === "BY_GROUP") return null; // drawn by `breakdownPie` from the recorded split, not by a chart specification
  const p = PLAN[view];
  const fits = kindsForTemplate(p.template);
  const kind = p.prefer.find((k) => fits.includes(k)) ?? fits[0];
  if (!kind) return null;
  return { version: 2, kind, dataset: { template: p.template, indicatorIds: [indicatorId], measure: "PERIOD", ...(p.placeLevel !== undefined ? { placeLevel: p.placeLevel } : {}), showTarget: view === "OVER_TIME", includeDraft: true } };
}
