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
  /** Read results some other way than the signed-in action. */
  loadResults?: PlaceResultsLoader | undefined;
  /** The data is a fixed snapshot (a share link): no drilling and no side-by-side periods. */
  staticData?: boolean | undefined;
  /** Planned activities naming each place directly (place id to count), for the place tree beside the map. */
  activityCounts?: Readonly<Record<string, number>> | undefined;
  /** Show only this indicator (the indicator's own page): the indicator list is not offered. */
  lockedIndicatorId?: string | undefined;
  /** The period is held by the page around the map (so a chart beside it can follow). Omit both to let the map keep its own. */
  periodId?: string | null | undefined;
  onPeriodChange?: ((periodId: string | null) => void) | undefined;
}
