/** Maps and the project list (Phase 45.1). Figures are read by the person looking, under their own access, and handed in as `data`; with none handed in the block is unavailable, never drawn from nothing. A place with no pin is listed, never guessed. */
import { projectListTable, type ProjectListQuery, type ProjectListSource } from "../../dashboards/project-list.js";
import type { MapWidgetQuery } from "../../dashboards/map-widget.js";
import type { DatasetPlace } from "../../reporting/dataset-query.js";
import { normalizeLocationKey } from "../../workplan/location-key.js";
import type { BlockModel } from "../block-definition.js";

export interface MapSite { id: string; title: string; place: string; latitude?: number | undefined; longitude?: number | undefined; signal: string; signalLabel: string }
export interface MapData { places?: DatasetPlace[] | undefined; sites?: MapSite[] | undefined }
export interface ProjectListData { projects: ProjectListSource[]; userId: string; bookmarkedIds?: string[] | undefined }

const has = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n);

export function mapModel(q: MapWidgetQuery, data: MapData | undefined): BlockModel<unknown> {
  const wanted = q.placeKeys?.length ? new Set(q.placeKeys) : null;
  if (q.view === "RESULTS") {
    if (!data?.places) return { state: "unavailable", reason: "The map's figures are read when it is opened." };
    const items = data.places.filter((p) => !wanted || wanted.has(normalizeLocationKey(p.name)));
    if (items.length === 0) return { state: "empty", reason: "No places to show yet." };
    const noFigure = items.filter((p) => p.value === null).length;
    const noPin = items.filter((p) => !has(p.latitude) || !has(p.longitude)).length;
    const notes = [...(noFigure > 0 ? [`${noFigure} of ${items.length} places have no figure yet.`] : []), ...(noPin > 0 ? [`${noPin} places have no pin; they are listed, not placed.`] : [])];
    return { state: "ready", notes, model: { view: "RESULTS", ...(q.title ? { title: q.title } : {}), ...(q.shading && q.shading !== "NONE" ? { shading: q.shading } : {}), items: items.map((p) => ({ name: p.name, path: p.path, level: p.level, value: p.value, partly: p.partly, ...(has(p.latitude) && has(p.longitude) ? { latitude: p.latitude, longitude: p.longitude } : {}) })) } };
  }
  if (!data?.sites) return { state: "unavailable", reason: "The map's activities are read when it is opened." };
  const sites = data.sites.filter((s) => !wanted || wanted.has(normalizeLocationKey(s.place)));
  if (sites.length === 0) return { state: "empty", reason: "No activities to show yet." };
  const placed = sites.filter((s) => has(s.latitude) && has(s.longitude));
  const unplaced = sites.filter((s) => !has(s.latitude) || !has(s.longitude)).map((s) => ({ id: s.id, title: s.title, place: s.place }));
  return { state: "ready", notes: unplaced.length > 0 ? [`${unplaced.length} activities could not be placed on the map; they are listed below it.`] : [], model: { view: "ACTIVITIES", ...(q.title ? { title: q.title } : {}), sites: placed, unplaced } };
}

export function projectListModel(q: ProjectListQuery, data: ProjectListData | undefined): BlockModel<unknown> {
  if (!data) return { state: "unavailable", reason: "A project list is drawn for the person looking." };
  const t = projectListTable(data.projects, q, data.userId, new Set(data.bookmarkedIds ?? []));
  return { state: "ready", model: { title: t.title, columns: t.columns, rows: t.rows }, notes: t.notes };
}
