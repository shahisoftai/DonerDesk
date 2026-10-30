/**
 * A map on a dashboard (Phase 35). It stores only what the map shows, never data: "RESULTS" is an indicator's recorded values by place
 * (shaded areas or symbols, with a period slider and a choice of detail), "ACTIVITIES" is where the planned activities are, coloured by how
 * delivery stands. The figures are read when the dashboard is opened, by the person opening it and under their own access; a share link
 * shows neither (the plan and recorded values by place are never sent through a link).
 */
export const MAP_VIEWS = ["RESULTS", "ACTIVITIES"] as const;
export type MapView = (typeof MAP_VIEWS)[number];

export const MAP_VIEW_LABEL: Readonly<Record<MapView, string>> = { RESULTS: "Results by place", ACTIVITIES: "Where activities are" };

export interface MapWidgetQuery {
  view: MapView;
  /** A name for the map; absent = the view's own. */
  title?: string | undefined;
}

export function validateMapWidget(q: MapWidgetQuery): string | null {
  if (!MAP_VIEWS.includes(q.view)) return "That map is not one a dashboard can show.";
  if (q.title !== undefined && q.title.length > 60) return "A map's name is at most 60 characters.";
  return null;
}
