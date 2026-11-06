import { definitionFor } from "@donordesk/domain/contexts/canvas/index.js";

/**
 * What a block starts with when added from the palette. Most blocks start from their own defaults; the chart and the table have no
 * usable default (they need an indicator), so they start as an empty question the person fills in, and the editor says what is missing.
 */
const SEEDS: Readonly<Record<string, () => unknown>> = {
  CHART: () => ({ spec: { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: [], measure: "PERIOD", showTarget: false, includeDraft: false } } }),
  TABLE: () => ({ query: { indicatorIds: [], measure: "PERIOD", rows: "PERIOD", includeDraft: false } }),
};

export const seedProps = (kind: string): unknown => SEEDS[kind]?.() ?? (definitionFor(kind) as unknown as { defaults(): unknown } | undefined)?.defaults() ?? {};
