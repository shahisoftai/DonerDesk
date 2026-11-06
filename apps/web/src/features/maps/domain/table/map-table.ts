/**
 * Every map as a table: the same places, figures and states the picture shows, in a form a screen reader, a keyboard and a slow connection
 * can all use. Pure. The table is built from the same model the map is, so the two can never disagree; a place with no figure says so
 * ("Not measured"), it is never a zero; a place the map could not draw is listed and marked, never dropped.
 */
import { DELIVERY_SIGNAL_LABEL } from "@donordesk/domain/contexts/workplan/index.js";
import type { SiteMapPoint } from "../../../workplan/domain/site-map.ts";
import type { JoinedUnit } from "../boundaries/join.ts";
import type { ExplorerModel } from "../map-explorer.ts";

export type FigureStatus = "VERIFIED" | "UNVERIFIED" | "NOT_MEASURED";

export interface MapTableRow {
  placeId: string;
  name: string;
  /** "Uganda › Gulu". */
  path: string;
  level: number;
  /** The figure as recorded, or null: never 0. */
  figure: string | null;
  status: FigureStatus;
  /** Drawn on the map: it has a boundary or a pin here. */
  onMap: boolean;
  /** The boundary it is drawn as, for selecting it. */
  ref: string | null;
}

export function buildMapTable(model: ExplorerModel, joined: readonly JoinedUnit[], levelOf: (placeId: string) => number | undefined): MapTableRow[] {
  const refByPlace = new Map<string, string>();
  for (const j of joined) if (j.placeId) refByPlace.set(j.placeId, j.unit.ref);
  const pinned = new Set(model.pins.map((p) => p.placeId));
  return model.regions
    .map((r): MapTableRow => ({
      placeId: r.placeId, name: r.name, path: r.path, level: levelOf(r.placeId) ?? model.level,
      figure: r.value === null ? null : r.display, status: r.value === null ? "NOT_MEASURED" : r.verified ? "VERIFIED" : "UNVERIFIED",
      onMap: refByPlace.has(r.placeId) || pinned.has(r.placeId), ref: refByPlace.get(r.placeId) ?? null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export interface SiteTableRow {
  id: string;
  name: string;
  where: string;
  items: Array<{ title: string; state: string }>;
  risks: string[];
}

/** The sites map as a table: one row per place, in the order the map's dots are drawn (the busiest first). */
export function buildSiteTable(points: readonly SiteMapPoint[]): SiteTableRow[] {
  return [...points]
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
    .map((p) => ({
      id: `${p.lat}|${p.lng}`, name: p.name, where: [p.province, p.country].filter(Boolean).join(", "),
      items: p.items.map((i) => ({ title: i.title, state: i.label ?? DELIVERY_SIGNAL_LABEL[i.signal] })), risks: p.risks,
    }));
}
