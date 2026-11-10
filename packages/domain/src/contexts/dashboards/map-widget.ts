/**
 * A map on a dashboard (Phase 35). It stores only what the map shows, never data: "RESULTS" is an indicator's recorded values by place
 * (shaded areas or symbols, with a period slider and a choice of detail), "ACTIVITIES" is where the planned activities are, coloured by how
 * delivery stands. The figures are read when the dashboard is opened, by the person opening it and under their own access; a share link
 * shows neither (the plan and recorded values by place are never sent through a link).
 */
export const MAP_VIEWS = ["RESULTS", "ACTIVITIES"] as const;
export type MapView = (typeof MAP_VIEWS)[number];

export const MAP_VIEW_LABEL: Readonly<Record<MapView, string>> = { RESULTS: "Results by place", ACTIVITIES: "Where activities are" };

/** What the first-level areas of a map are shaded by (an infographic's choice; absent = no shading). */
export const MAP_SHADINGS = ["NONE", "REACH", "ACTIVITIES_DONE", "ACTIVITIES_PLANNED"] as const;
export type MapShading = (typeof MAP_SHADINGS)[number];
export const MAP_MAX_PLACE_KEYS = 50;

export interface MapWidgetQuery {
  view: MapView;
  /** Shade areas by this figure; absent = none. Carried so a design that had a shading keeps it. */
  shading?: MapShading | undefined;
  /** Show only these places (canonical location keys); absent or empty = every recorded place. */
  placeKeys?: string[] | undefined;
  /** A name for the map; absent = the view's own. */
  title?: string | undefined;
  /** RESULTS: the indicator the map opens on; absent = the first with figures by place. The viewer can still switch. */
  indicatorId?: string | undefined;
}

export function validateMapWidget(q: MapWidgetQuery): string | null {
  if (!MAP_VIEWS.includes(q.view)) return "That map is not one a dashboard can show.";
  if (q.title !== undefined && q.title.length > 60) return "A map's name is at most 60 characters.";
  if (q.indicatorId !== undefined && (q.view !== "RESULTS" || !q.indicatorId.trim() || q.indicatorId.length > 64)) return "Only a results map opens on a chosen indicator.";
  if (q.shading !== undefined && !MAP_SHADINGS.includes(q.shading)) return "Choose one of the offered map shadings.";
  if (q.placeKeys !== undefined && (q.placeKeys.length > MAP_MAX_PLACE_KEYS || q.placeKeys.some((k) => !k.trim() || k.length > 80))) return `A map shows at most ${MAP_MAX_PLACE_KEYS} chosen places.`;
  return null;
}
