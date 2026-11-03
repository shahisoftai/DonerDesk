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
}
