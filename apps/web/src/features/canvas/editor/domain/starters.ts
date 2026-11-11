/**
 * Starter sets for the Add drawer (Phase 50.1): several blocks added as one step, laid out together. They name kinds and settings
 * only, never figures; each block still has to be pointed at its indicators. Pure data plus one function that places a set.
 */
import type { CardItem } from "@donordesk/domain/contexts/dashboards/index.js";

export interface StarterBlock { kind: string; props: unknown; x: number; y: number; w: number; h: number; format?: unknown }
export interface StarterSet { id: string; labelKey: string; blocks: readonly StarterBlock[] }

const accent = { show: true, side: "start", thickness: 6, color: { role: "accent" } } as const;
const count = (metric: string, extra: Record<string, unknown> = {}): CardItem => ({ source: { kind: "COUNT", metric, ...extra } as CardItem["source"] });

export const STARTER_SETS: readonly StarterSet[] = [
  { id: "countRow", labelKey: "starter.countRow", blocks: [
    { kind: "MULTI_CARD", x: 0, y: 0, w: 4, h: 2, props: { items: [count("PLACES_REACHED", { level: 2 })], layout: "COLUMN", columns: 1, includeDraft: false }, format: { accentBar: accent } },
    { kind: "MULTI_CARD", x: 4, y: 0, w: 4, h: 2, props: { items: [count("DONORS")], layout: "COLUMN", columns: 1, includeDraft: false }, format: { accentBar: accent } },
    { kind: "MULTI_CARD", x: 8, y: 0, w: 4, h: 2, props: { items: [count("PARTNERS")], layout: "COLUMN", columns: 1, includeDraft: false }, format: { accentBar: accent } },
  ] },
  { id: "provincePanel", labelKey: "starter.provincePanel", blocks: [
    { kind: "REPEATER", x: 0, y: 0, w: 12, h: 4, props: { over: "PLACE", limit: 6 } },
    { kind: "MULTI_CARD", x: 0, y: 0, w: 4, h: 3, props: { items: [count("PLACES_REACHED", { level: 2 }), count("DONORS"), count("PARTNERS")], layout: "GRID", columns: 3, includeDraft: false }, format: { accentBar: { ...accent, side: "top" } } },
  ] },
  { id: "filterBar", labelKey: "starter.filterBar", blocks: [
    { kind: "FILTER_BAR", x: 0, y: 0, w: 12, h: 1, props: { dimensions: ["PLACE", "FUNDING_SOURCE", "PARTNER", "DONOR", "PERIOD"], controls: [{ dimension: "PLACE", levels: [1, 2], multi: true, search: true }], options: { clearAll: true, cascade: true } } },
  ] },
];

/** The rows a set starts at: below everything already on the page. */
export const starterTop = (blocks: ReadonlyArray<{ bounds: { y: number; h: number } }>): number => blocks.reduce((m, b) => Math.max(m, b.bounds.y + b.bounds.h), 0);
