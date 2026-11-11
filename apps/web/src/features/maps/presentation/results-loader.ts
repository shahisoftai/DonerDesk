import type { getPlaceResultsAction } from "@/lib/actions/places";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";

/** How the explorer reads results for a level and period: the signed-in action by default, or a fixed answer (a share link, which has no session). */
export type PlaceResultsLoader = (projectId: string, level: number, periodId?: string) => ReturnType<typeof getPlaceResultsAction>;

export interface ExplorerProps {
  projectId: string;
  places: readonly PlaceItem[];
  initial: PlaceResults | null;
  periods: ReadonlyArray<{ id: string; label: string }>;
  /** The dashboard card: one column, no layer panel, no file layer and no side-by-side periods. */
  compact?: boolean;
  /** The indicator the map opens on (a dashboard map's own setting); absent or unknown = the first one with figures by place. */
  initialIndicatorId?: string | undefined;
  /** Read results some other way than the signed-in action. */
  loadResults?: PlaceResultsLoader | undefined;
  /** The data is a fixed snapshot (a share link): no drilling and no side-by-side periods. */
  staticData?: boolean | undefined;
  /** Planned activities naming each place directly (place id to count), for the place tree beside the map. */
  activityCounts?: Readonly<Record<string, number>> | undefined;
  /** The organisation's map context settings when the page read them on the server (Phase 49.6): shown at once, not after a later call. */
  mapContext?: import("@/lib/server/schemas-map-context").MapContextDto | null | undefined;
  /** Show only this indicator (the indicator's own page): the indicator list is not offered. */
  lockedIndicatorId?: string | undefined;
  /** The period is held by the page around the map (so a chart beside it can follow). Omit both to let the map keep its own. */
  periodId?: string | null | undefined;
  onPeriodChange?: ((periodId: string | null) => void) | undefined;
  /** What the map is drawn on (Phase 51): a dashboard map's own setting; absent = the street map. A person can still switch it on a full explorer. */
  ground?: import("../domain/ground").MapGround | undefined;
  /** How areas are coloured and labelled (a dashboard map's own setting, Phase 50.3d). */
  areaStyle?: import("../domain/scene/area-style").AreaStyle | undefined;
  /** Figure cards beside chosen areas, already resolved for the person looking. */
  callouts?: { cards: ReadonlyArray<{ key: string; name: string; text?: string | undefined; placeKey?: string | undefined; figures: ReadonlyArray<import("@donordesk/domain/contexts/dashboards/index.js").CardFigure> }>; columns: number; accent: string; offsets?: Readonly<Record<string, { dx: number; dy: number }>> | undefined; onMove?: ((key: string, offset: { dx: number; dy: number } | null) => void) | undefined; /** Read-only view: a visitor may move cards for themself (not saved). */ viewerMovable?: boolean | undefined } | undefined;
}

/** The indicator a map opens on: the one asked for when the results carry it, else the first. */
export function firstIndicator(results: PlaceResults | null, wanted: string | undefined): string {
  if (wanted && results?.indicators.some((i) => i.id === wanted)) return wanted;
  return results?.indicators[0]?.id ?? "";
}
