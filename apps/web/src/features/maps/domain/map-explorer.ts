/**
 * The interactive map (Phase 35.0): what the explorer shows and what a click means. Pure: no React, no
 * ECharts, no clock, no server. The component only draws what these functions decide.
 *
 * Rules carried from the maps work: a missing value is never 0 (a place nobody reported is grey and says
 * so); a rate is shown for the place that recorded it and never combined (the roll-up already decides
 * that, we only read it); a place without a pin is listed, never guessed onto the map.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import type { PlaceItem, PlaceResults, PlaceRollupRow } from "../../../lib/server/schemas-places.ts";

// ---- Layers ---------------------------------------------------------------------------------------------

export type LayerKind = "FILL" | "SYMBOLS" | "BOUNDARIES" | "OVERLAY";

export interface ExplorerLayer {
  id: LayerKind;
  visible: boolean;
  /** 0.1 – 1. */
  opacity: number;
}

export const DEFAULT_LAYERS: readonly ExplorerLayer[] = [
  { id: "FILL", visible: true, opacity: 0.85 },
  { id: "SYMBOLS", visible: true, opacity: 1 },
  { id: "BOUNDARIES", visible: true, opacity: 1 },
];

const clampOpacity = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0.1, value)) : 1);

export function toggleLayer(layers: readonly ExplorerLayer[], id: LayerKind): ExplorerLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
}

export function setLayerOpacity(layers: readonly ExplorerLayer[], id: LayerKind, opacity: number): ExplorerLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, opacity: clampOpacity(opacity) } : l));
}

/** Moves a layer up (towards drawn last, on top) or down by one; the ends stay put. */
export function moveLayer(layers: readonly ExplorerLayer[], id: LayerKind, direction: "UP" | "DOWN"): ExplorerLayer[] {
  const at = layers.findIndex((l) => l.id === id);
  const to = direction === "UP" ? at + 1 : at - 1;
  if (at < 0 || to < 0 || to >= layers.length) return [...layers];
  const next = [...layers];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return next;
}

/** The layers every visit starts with; OVERLAY is added only when a file is loaded. */
export const OVERLAY_LAYER: ExplorerLayer = { id: "OVERLAY", visible: true, opacity: 1 };

export const layerState = (layers: readonly ExplorerLayer[], id: LayerKind): ExplorerLayer => layers.find((l) => l.id === id) ?? { id, visible: false, opacity: 1 };

// ---- Numbers --------------------------------------------------------------------------------------------

/** "1,200.5" -> 1200.5; anything that is not a plain number (including "" and null) is null — never 0. */
export function numericValue(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = text.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ---- Colour scale (one rule, shared by the fill and the legend) -------------------------------------------

export const FILL_RAMP: readonly string[] = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"];
export const NO_DATA_COLOR = "#e5e7eb";

export interface ScaleBand {
  from: number;
  to: number;
  color: string;
}

/** Equal-interval bands over the reported values; one value gives one band. No value gives none. */
export function scaleBands(values: ReadonlyArray<number>, ramp: readonly string[] = FILL_RAMP): ScaleBand[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, color: ramp[ramp.length - 1]! }];
  const step = (max - min) / ramp.length;
  return ramp.map((color, i) => ({ from: min + step * i, to: i === ramp.length - 1 ? max : min + step * (i + 1), color }));
}

export function colorFor(value: number | null, bands: readonly ScaleBand[]): string {
  if (value === null || bands.length === 0) return NO_DATA_COLOR;
  const band = bands.find((b, i) => value >= b.from && (value < b.to || i === bands.length - 1));
  return band?.color ?? NO_DATA_COLOR;
}

// ---- The model the map draws -------------------------------------------------------------------------------

export interface MapPin {
  placeId: string;
  name: string;
  path: string;
  lat: number;
  lng: number;
  value: number | null;
  display: string | null;
  verified: boolean;
}

export interface MapRegion {
  placeId: string;
  name: string;
  key: string;
  path: string;
  value: number | null;
  display: string | null;
  verified: boolean;
}

export interface ExplorerModel {
  indicatorId: string;
  level: number;
  /** Places that have a figure and a pin. */
  pins: MapPin[];
  /** Areas (and pins read as areas) matched to a boundary by name. */
  regions: MapRegion[];
  /** Places with a figure but no pin and no boundary at this level: named, never guessed. */
  unmapped: Array<{ placeId: string; name: string; path: string; display: string | null }>;
  bands: ScaleBand[];
  /** Why a figure is not shown for a place: "Not combined" etc., straight from the roll-up. */
  isRate: boolean;
}

export function buildExplorerModel(results: PlaceResults, places: readonly PlaceItem[], indicatorId: string): ExplorerModel | null {
  const indicator = results.indicators.find((i) => i.id === indicatorId);
  if (!indicator) return null;
  const byId = new Map(places.map((p) => [p.id, p]));
  const pins: MapPin[] = [];
  const regions: MapRegion[] = [];
  const unmapped: ExplorerModel["unmapped"] = [];
  for (const row of indicator.rollup.rows) {
    const place = byId.get(row.placeId);
    const value = numericValue(row.value);
    const common = { placeId: row.placeId, name: row.name, path: row.path, value, display: row.value, verified: row.verified };
    regions.push({ ...common, key: normalizeLocationKey(row.name) });
    if (place?.latitude !== undefined && place.longitude !== undefined) {
      pins.push({ ...common, lat: place.latitude, lng: place.longitude });
    } else if (place?.kind !== "AREA") {
      unmapped.push({ placeId: row.placeId, name: row.name, path: row.path, display: row.value });
    }
  }
  const reported = [...pins, ...regions].map((r) => r.value).filter((v): v is number => v !== null);
  return { indicatorId, level: results.level, pins, regions, unmapped, bands: scaleBands(reported), isRate: indicator.isRate };
}

/** The fill colour per boundary name (normalised), for the geo regions of whichever map is showing. */
export function regionColors(model: ExplorerModel): Map<string, { color: string; region: MapRegion }> {
  const out = new Map<string, { color: string; region: MapRegion }>();
  for (const region of model.regions) out.set(region.key, { color: colorFor(region.value, model.bands), region });
  return out;
}

// ---- Drilling down ---------------------------------------------------------------------------------------

/** `depth` is the admin level shown inside the country: 1 provinces (bundled), 2 districts, 3 sub-districts (boundary files). */
export type DrillState = { kind: "WORLD" } | { kind: "COUNTRY"; country: string; depth: 1 | 2 | 3 };

export const WORLD_VIEW: DrillState = { kind: "WORLD" };

export const drillInto = (country: string, depth: 1 | 2 | 3 = 1): DrillState => (country.trim() === "" ? WORLD_VIEW : { kind: "COUNTRY", country, depth });

/** Same country, a different depth. */
export const withDepth = (state: DrillState, depth: 1 | 2 | 3): DrillState => (state.kind === "COUNTRY" ? { ...state, depth } : state);
export const drillUp = (_state: DrillState): DrillState => WORLD_VIEW;

/** The level to read when the view changes: a country opens at provinces (1), the world at countries (0). */
export function levelForView(state: DrillState, available: readonly number[]): number {
  const wanted = state.kind === "WORLD" ? 0 : state.depth;
  if (available.length === 0 || available.includes(wanted)) return wanted;
  return available.find((l) => l >= wanted) ?? available[available.length - 1]!;
}

// ---- The place panel (what a click shows) --------------------------------------------------------------

export interface PlacePanel {
  placeId: string;
  name: string;
  path: string;
  /** Ancestors from the top, e.g. ["Sudan", "White Nile"]. */
  trail: string[];
  /** One line per indicator that has a row for this place. */
  figures: Array<{ indicatorId: string; code: string; name: string; unit: string | null; display: string | null; verified: boolean; partly: boolean; note: string | null }>;
  /** Places directly inside it, with the selected indicator's figure. */
  children: Array<{ placeId: string; name: string; display: string | null }>;
  /** True when it has a pin, so the map can centre on it. */
  pinned: boolean;
}

function noteFor(row: PlaceRollupRow, isRate: boolean): string | null {
  if (row.value === null) return isRate ? "A rate is not combined across places" : "Not combined";
  if (row.partly) return `Partly reported (${row.contributors} of ${row.listedBelow} places)`;
  if (row.unverified > 0) return `${row.unverified} not verified yet`;
  return null;
}

export function placePanel(placeId: string, places: readonly PlaceItem[], results: PlaceResults | null, selectedIndicatorId: string): PlacePanel | null {
  const place = places.find((p) => p.id === placeId);
  if (!place) return null;
  const trail = place.path.split("›").map((s) => s.trim()).filter(Boolean).reverse().slice(0, -1);
  const figures: PlacePanel["figures"] = [];
  const selected = results?.indicators.find((i) => i.id === selectedIndicatorId);
  for (const ind of results?.indicators ?? []) {
    const row = ind.rollup.rows.find((r) => r.placeId === placeId);
    if (!row) continue;
    figures.push({ indicatorId: ind.id, code: ind.code, name: ind.name, unit: ind.unit, display: row.value, verified: row.verified, partly: row.partly, note: noteFor(row, ind.isRate) });
  }
  const children = places
    .filter((p) => p.parentId === placeId && !p.archived)
    .map((p) => ({ placeId: p.id, name: p.name, display: selected?.rollup.rows.find((r) => r.placeId === p.id)?.value ?? null }));
  return { placeId, name: place.name, path: place.path, trail, figures, children, pinned: place.latitude !== undefined && place.longitude !== undefined };
}

/** Finds the place a clicked boundary stands for: by name, preferring the level being read. */
export function placeForRegion(regionName: string, places: readonly PlaceItem[], level: number): PlaceItem | null {
  const key = normalizeLocationKey(regionName);
  const sameName = places.filter((p) => !p.archived && normalizeLocationKey(p.name) === key);
  return sameName.find((p) => p.adminLevel === level) ?? sameName[0] ?? null;
}

/** One sentence under the map, so the picture is never the only account of it. */
export function mapSummary(model: ExplorerModel): string {
  const withValue = model.regions.filter((r) => r.value !== null).length;
  const parts = [`${withValue} of ${model.regions.length} places have a figure`];
  if (model.pins.length > 0) parts.push(`${model.pins.length} pinned`);
  if (model.unmapped.length > 0) parts.push(`${model.unmapped.length} not on the map (no pin)`);
  return parts.join("; ") + ".";
}

/** A project working in one country opens on that country; anything else opens on the world. */
export function defaultView(places: readonly PlaceItem[]): DrillState {
  const countries = places.filter((p) => !p.archived && p.adminLevel === 0);
  return countries.length === 1 ? drillInto(countries[0]!.name) : WORLD_VIEW;
}

// ---- Small multiples (one map per period, one shared scale) ---------------------------------------------------

/** The same scale for every panel: maps drawn on different scales cannot be compared by eye. */
export function sharedBands(models: ReadonlyArray<ExplorerModel>): ScaleBand[] {
  return scaleBands(models.flatMap((m) => [...m.pins, ...m.regions].map((r) => r.value).filter((v): v is number => v !== null)));
}

export const withBands = (model: ExplorerModel, bands: ScaleBand[]): ExplorerModel => ({ ...model, bands });

/** The latest `count` periods, in order, for the panels (more than six is unreadable side by side). */
export function panelPeriods<T>(periods: readonly T[], count = 6): T[] {
  return periods.slice(Math.max(0, periods.length - count));
}
