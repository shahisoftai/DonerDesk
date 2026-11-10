/**
 * Scene -> MapLibre sources and layers. Pure data (no map instance), so it is unit-tested without a browser.
 * Every id starts with `dd-`, so the renderer can remove its own layers and never touch the basemap's.
 */
import type { ContextLayerSpec, FillLayerSpec, MapScene, OverlayLayerSpec, PinsLayerSpec } from "../../domain/model/scene.ts";

export type GeoJson = { type: "FeatureCollection"; features: unknown[] };
export interface SourceDef {
  id: string; data?: GeoJson; cluster?: boolean;
  /** A vector-tile source (boundary tiles, Phase 49.3; context points, 49.6) instead of GeoJSON. */ url?: string;
  /** A raster source (population cells or imagery, Phase 49.6): a PMTiles address in `url`, or tile templates here. */ raster?: { tiles?: string[]; attribution: string };
  attribution?: string;
}
export interface LayerDef { id: string; type: string; source: string; "source-layer"?: string; filter?: unknown[]; paint: Record<string, unknown>; layout?: Record<string, unknown> }
export interface Built { sources: SourceDef[]; layers: LayerDef[]; /** Same key = same data, so only filters and paints need updating. */ dataKey: string }

export const IDS = { fill: "dd-fill", outline: "dd-outline", selected: "dd-selected", selectedHalo: "dd-selected-halo", clusters: "dd-clusters", clusterCount: "dd-cluster-count", pins: "dd-pins", overlayLines: "dd-overlay-lines", overlayPoints: "dd-overlay-points" } as const;
export const SOURCES = { fill: "dd-fill-src", pins: "dd-pins-src", overlay: "dd-overlay-src" } as const;
const FONT = ["Noto Sans Medium"];

/** Every cluster carries the worst rank of the pins inside it (Phase 49.4), so it can take the worst pin's colour. */
export const CLUSTER_PROPERTIES = { rank: ["max", ["coalesce", ["get", "rank"], 0]] } as const;

/**
 * Boundaries from vector tiles (Phase 49.3): the tile file holds outlines and refs only, never a value. Colours are a `match` on the ref, and
 * only the refs of this view are drawn, so a neighbouring country's units in the same tile stay hidden.
 */
function tiledFill(spec: FillLayerSpec, overStreets: boolean, tile: { url: string; sourceLayer: string }): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
  const refs = spec.features.map((f) => f.ref);
  const colour: unknown[] = refs.length > 0 ? ["match", ["get", "ref"], ...spec.features.flatMap((f) => [f.ref, f.color]), "#cbd5e1"] : ["literal", "#cbd5e1"];
  const shown = ["in", ["get", "ref"], ["literal", refs]];
  const selected = spec.selectedRef ?? "";
  const on = (extra: Partial<LayerDef>): Pick<LayerDef, "source" | "source-layer"> & Partial<LayerDef> => ({ source: SOURCES.fill, "source-layer": tile.sourceLayer, ...extra });
  const layers: LayerDef[] = [{ id: IDS.fill, type: "fill", ...on({ filter: shown }), paint: { "fill-color": colour, "fill-opacity": overStreets ? spec.opacity * 0.62 : spec.opacity } } as LayerDef];
  if (spec.outline) layers.push({ id: IDS.outline, type: "line", ...on({ filter: shown }), paint: { "line-color": "#475569", "line-width": 0.8, "line-opacity": 0.9 } } as LayerDef);
  layers.push(
    { id: IDS.selectedHalo, type: "line", ...on({ filter: ["==", ["get", "ref"], selected] }), paint: { "line-color": "#ffffff", "line-width": 5 } } as LayerDef,
    { id: IDS.selected, type: "line", ...on({ filter: ["==", ["get", "ref"], selected] }), paint: { "line-color": "#0f172a", "line-width": 2.5 } } as LayerDef,
  );
  return { sources: [{ id: SOURCES.fill, url: `pmtiles://${tile.url}` }], layers, key: `tiles:${tile.url}:${spec.outline}:${spec.features.map((f) => `${f.ref}~${f.color}`).join("|")}` };
}

function fill(spec: FillLayerSpec, overStreets: boolean): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
  const tile = spec.features[0]?.tile;
  if (tile && spec.features.every((f) => f.tile?.url === tile.url)) return tiledFill(spec, overStreets, tile);
  const data: GeoJson = { type: "FeatureCollection", features: spec.features.map((f) => ({ type: "Feature", properties: { ref: f.ref, name: f.name, color: f.color }, geometry: f.geometry })) };
  const selected = spec.selectedRef ?? "";
  const layers: LayerDef[] = [{ id: IDS.fill, type: "fill", source: SOURCES.fill, paint: { "fill-color": ["get", "color"], "fill-opacity": overStreets ? spec.opacity * 0.62 : spec.opacity } }];
  if (spec.outline) layers.push({ id: IDS.outline, type: "line", source: SOURCES.fill, paint: { "line-color": "#475569", "line-width": 0.8, "line-opacity": 0.9 } });
  layers.push(
    { id: IDS.selectedHalo, type: "line", source: SOURCES.fill, filter: ["==", ["get", "ref"], selected], paint: { "line-color": "#ffffff", "line-width": 5 } },
    { id: IDS.selected, type: "line", source: SOURCES.fill, filter: ["==", ["get", "ref"], selected], paint: { "line-color": "#0f172a", "line-width": 2.5 } },
  );
  return { sources: [{ id: SOURCES.fill, data }], layers, key: `fill:${spec.outline}:${spec.features.map((f) => `${f.ref}~${f.color}`).join("|")}` };
}

function pins(spec: PinsLayerSpec): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
  const data: GeoJson = { type: "FeatureCollection", features: spec.pins.map((p) => ({ type: "Feature", properties: { id: p.id, name: p.name, color: p.color, radius: p.radius, rank: p.rank ?? 0 }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) };
  const selected = spec.selectedId ?? "";
  const layers: LayerDef[] = [];
  const unclustered = spec.cluster ? ["!", ["has", "point_count"]] : undefined;
  if (spec.cluster) {
    layers.push(
      { id: IDS.clusters, type: "circle", source: SOURCES.pins, filter: ["has", "point_count"], paint: { "circle-color": spec.rankColors && spec.rankColors.length > 0 ? ["match", ["get", "rank"], ...spec.rankColors.flatMap((c, i) => [i, c]), spec.rankColors[0]] : ["step", ["get", "point_count"], "#93c5fd", 20, "#3b82f6", 100, "#1d4ed8"], "circle-radius": ["step", ["get", "point_count"], 14, 20, 20, 100, 28], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-opacity": spec.opacity } },
      { id: IDS.clusterCount, type: "symbol", source: SOURCES.pins, filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12 }, paint: { "text-color": spec.rankColors ? "#ffffff" : "#0f172a" } },
    );
  }
  layers.push({
    id: IDS.pins, type: "circle", source: SOURCES.pins, ...(unclustered ? { filter: unclustered } : {}),
    paint: {
      "circle-color": ["get", "color"], "circle-radius": ["get", "radius"], "circle-opacity": spec.opacity,
      "circle-stroke-color": ["case", ["==", ["get", "id"], selected], "#0f172a", "#ffffff"],
      "circle-stroke-width": ["case", ["==", ["get", "id"], selected], 3, 1.5],
    },
  });
  return { sources: [{ id: SOURCES.pins, data, cluster: spec.cluster }], layers, key: `pins:${spec.cluster}:${spec.rankColors?.join(",") ?? ""}:${spec.pins.map((p) => `${p.id}~${p.color}~${p.radius}~${p.lng}~${p.lat}`).join("|")}` };
}

function overlay(spec: OverlayLayerSpec): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
  const features: unknown[] = [
    ...spec.lines.map((l) => ({ type: "Feature", properties: { name: l.name }, geometry: { type: "LineString", coordinates: l.coords } })),
    ...spec.points.map((p) => ({ type: "Feature", properties: { name: p.name }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
  ];
  return {
    sources: [{ id: SOURCES.overlay, data: { type: "FeatureCollection", features } }],
    layers: [
      { id: IDS.overlayLines, type: "line", source: SOURCES.overlay, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#7c3aed", "line-width": 2, "line-opacity": spec.opacity } },
      { id: IDS.overlayPoints, type: "circle", source: SOURCES.overlay, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": "#7c3aed", "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5, "circle-opacity": spec.opacity } },
    ],
    key: `overlay:${spec.lines.length}:${spec.points.length}:${spec.lines.map((l) => l.name).join(",")}`,
  };
}

/** A context layer (Phase 49.6). Its ids carry the layer's own id so several can be shown; they start with `dd-ctx-` and are never pickable. */
function context(spec: ContextLayerSpec): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
  const source = `dd-ctx-${spec.id}-src`, layer = `dd-ctx-${spec.id}`;
  if (spec.type === "points") {
    return {
      sources: [{ id: source, url: `pmtiles://${spec.url}`, attribution: spec.attribution }],
      layers: [{ id: layer, type: "circle", source, "source-layer": spec.sourceLayer ?? spec.id, paint: { "circle-color": "#475569", "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 4], "circle-stroke-color": "#ffffff", "circle-stroke-width": 0.8, "circle-opacity": spec.opacity } }],
      key: `ctx:${spec.id}:${spec.url}`,
    };
  }
  const raster = spec.type === "imagery" ? { tiles: [spec.url], attribution: spec.attribution } : { attribution: spec.attribution };
  return {
    sources: [{ id: source, ...(spec.type === "imagery" ? {} : { url: `pmtiles://${spec.url}` }), raster }],
    layers: [{ id: layer, type: "raster", source, paint: { "raster-opacity": spec.opacity } }],
    key: `ctx:${spec.id}:${spec.url}`,
  };
}

/** `overStreets`: a street basemap is under the boundaries, so the fill lets it show through. */
export function buildMapLibreLayers(scene: MapScene, overStreets = false): Built {
  // Rasters and imagery under the results (a ground to read them against); context points above the shading (or the fill would hide
  // them) and under the project's own pins, which stay on top.
  const under = scene.layers.filter((l) => l.kind === "CONTEXT" && l.type !== "points");
  const points = scene.layers.filter((l) => l.kind === "CONTEXT" && l.type === "points");
  const rest = scene.layers.filter((l) => l.kind !== "CONTEXT");
  const ordered = [...under, ...rest.filter((l) => l.kind === "FILL"), ...points, ...rest.filter((l) => l.kind !== "FILL")];
  const parts = ordered.map((l) => (l.kind === "CONTEXT" ? context(l) : l.kind === "FILL" ? fill(l, overStreets) : l.kind === "PINS" ? pins(l) : overlay(l)));
  return { sources: parts.flatMap((p) => p.sources), layers: parts.flatMap((p) => p.layers), dataKey: parts.map((p) => p.key).join("#") };
}

/** Layers a click can land on, top first: pins, then boundaries. */
export const PICKABLE: readonly string[] = [IDS.pins, IDS.fill];
