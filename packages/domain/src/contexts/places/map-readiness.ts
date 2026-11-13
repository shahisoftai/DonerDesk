/**
 * Why a project's map is empty, in plain order (Phase 53.2). The map shows the first reason as one sentence and one action instead of an
 * empty ground. A reason is a row in `MAP_READINESS_RULES`; the screen's copy is keyed on the code (exhaustive). Pure.
 */
export type MapReadinessCode = "NO_PLACES" | "NO_INDICATOR_BY_PLACE" | "NO_VALUES_YET" | "PLACES_TO_CONFIRM";
export const MAP_READINESS_CODES: readonly MapReadinessCode[] = ["NO_PLACES", "NO_INDICATOR_BY_PLACE", "NO_VALUES_YET", "PLACES_TO_CONFIRM"];

export interface MapReadinessInput {
  placeCount: number;
  indicators: ReadonlyArray<{ id: string; code: string; name: string; recordByPlace: boolean; hasFigureByPlace: boolean }>;
  /** Typed locations no place answers to (the "Places to confirm" list). */
  unconfirmedLocations: number;
}
export interface MapReadiness { code: MapReadinessCode; indicatorIds: string[]; count: number }
type Rule = (input: MapReadinessInput) => MapReadiness | null;

export const MAP_READINESS_RULES: readonly Rule[] = [
  (i) => (i.placeCount === 0 ? { code: "NO_PLACES", indicatorIds: [], count: 0 } : null),
  (i) => {
    const by = i.indicators.filter((x) => x.recordByPlace);
    return by.length === 0 ? { code: "NO_INDICATOR_BY_PLACE", indicatorIds: i.indicators.map((x) => x.id), count: i.indicators.length } : null;
  },
  (i) => (i.indicators.some((x) => x.hasFigureByPlace) ? null : { code: "NO_VALUES_YET", indicatorIds: i.indicators.filter((x) => x.recordByPlace).map((x) => x.id), count: i.indicators.filter((x) => x.recordByPlace).length }),
  (i) => (i.unconfirmedLocations > 0 ? { code: "PLACES_TO_CONFIRM", indicatorIds: [], count: i.unconfirmedLocations } : null),
];

/** The first reason the map has nothing (or not everything) to draw, or null when it is ready. */
export function mapReadiness(input: MapReadinessInput): MapReadiness | null {
  for (const rule of MAP_READINESS_RULES) { const out = rule(input); if (out) return out; }
  return null;
}
