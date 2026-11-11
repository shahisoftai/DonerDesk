import { multiCardProblems, type CardItem } from "./multi-card.js";
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

/**
 * How areas are coloured (Phase 50.3d): VALUE is the results gradient, RULES colours by bands of the value, CATEGORY gives each area at a
 * chosen level its own colour (the provinces of a country) and always shows a legend, NONE draws outlines only. A gap is grey in every mode.
 */
export const MAP_COLOR_MODES = ["VALUE", "RULES", "CATEGORY", "NONE"] as const;
export type MapColorMode = (typeof MAP_COLOR_MODES)[number];
export const MAP_AREA_LABELS = ["NONE", "NAME", "VALUE", "NAME_AND_VALUE"] as const;
export interface MapBand { from: number | null; to: number | null; color: string }
export interface MapCallouts { placeKeys: string[]; items: CardItem[]; columns: number }

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
  colorBy?: MapColorMode | undefined;
  /** CATEGORY: the admin level whose areas each get a colour (1 = provinces). */
  categoryLevel?: number | undefined;
  /** RULES: value bands, low to high; `from`/`to` null = open-ended. Colours are #rrggbb. */
  bands?: MapBand[] | undefined;
  areaLabels?: (typeof MAP_AREA_LABELS)[number] | undefined;
  /** Extra figures in an area's tooltip (indicator ids, at most 6). */
  tooltipIndicatorIds?: string[] | undefined;
  /** A click on an area sets the place filter (default on). */
  clickToFilter?: boolean | undefined;
  /** Figure cards beside chosen areas, with a line to each. */
  callouts?: MapCallouts | undefined;
}

export function mapStyleProblems(q: MapWidgetQuery): string | null {
  if (q.colorBy !== undefined && !MAP_COLOR_MODES.includes(q.colorBy)) return "Choose how the map's areas are coloured.";
  if (q.colorBy === "CATEGORY" && (q.categoryLevel === undefined || !Number.isInteger(q.categoryLevel) || q.categoryLevel < 0 || q.categoryLevel > 4)) return "Choose the level whose areas get their own colour.";
  if (q.colorBy !== "CATEGORY" && q.categoryLevel !== undefined) return "Only a map coloured by area takes a level.";
  if (q.colorBy === "RULES") {
    const b = q.bands ?? [];
    if (b.length < 1 || b.length > 8) return "A map coloured by rules has 1 to 8 bands.";
    if (b.some((x) => !/^#[0-9a-f]{6}$/i.test(x.color))) return "A band's colour is written #rrggbb.";
    if (b.some((x) => x.from !== null && x.to !== null && x.from >= x.to)) return "A band's low end is below its high end.";
    for (let i = 1; i < b.length; i++) { const p = b[i - 1]!, c = b[i]!; if (p.to === null || c.from === null || c.from < p.to) return "Bands go from low to high without overlapping."; }
  } else if (q.bands !== undefined) return "Only a map coloured by rules takes bands.";
  if (q.areaLabels !== undefined && !MAP_AREA_LABELS.includes(q.areaLabels)) return "Unknown area labels.";
  if ((q.tooltipIndicatorIds?.length ?? 0) > 6) return "A tooltip shows at most 6 extra figures.";
  if (q.callouts) {
    if (q.view !== "RESULTS") return "Figure cards go on a results map.";
    if (q.callouts.placeKeys.length < 1 || q.callouts.placeKeys.length > 12) return "Choose 1 to 12 areas for figure cards.";
    if (q.callouts.items.length < 1 || q.callouts.items.length > 9) return "A figure card on a map shows 1 to 9 figures.";
    if (!Number.isInteger(q.callouts.columns) || q.callouts.columns < 1 || q.callouts.columns > 3) return "A figure card on a map has 1 to 3 columns.";
    const card = multiCardProblems({ items: q.callouts.items, layout: "GRID", columns: q.callouts.columns, includeDraft: false });
    if (card.length) return card[0]!;
  }
  return null;
}

/** Which band a value falls in; a gap has none (it is grey). */
export function bandFor(value: number | null, bands: readonly MapBand[]): MapBand | null {
  if (value === null || !Number.isFinite(value)) return null;
  return bands.find((b) => (b.from === null || value >= b.from) && (b.to === null || value < b.to)) ?? null;
}

export function validateMapWidget(q: MapWidgetQuery): string | null {
  if (!MAP_VIEWS.includes(q.view)) return "That map is not one a dashboard can show.";
  if (q.title !== undefined && q.title.length > 60) return "A map's name is at most 60 characters.";
  if (q.indicatorId !== undefined && (q.view !== "RESULTS" || !q.indicatorId.trim() || q.indicatorId.length > 64)) return "Only a results map opens on a chosen indicator.";
  if (q.shading !== undefined && !MAP_SHADINGS.includes(q.shading)) return "Choose one of the offered map shadings.";
  const style = mapStyleProblems(q);
  if (style) return style;
  if (q.placeKeys !== undefined && (q.placeKeys.length > MAP_MAX_PLACE_KEYS || q.placeKeys.some((k) => !k.trim() || k.length > 80))) return `A map shows at most ${MAP_MAX_PLACE_KEYS} chosen places.`;
  return null;
}
