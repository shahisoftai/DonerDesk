/**
 * Scene -> MapLibre sources and layers. Pure data (no map instance), so it is unit-tested without a browser.
 * Every id starts with `dd-`, so the renderer can remove its own layers and never touch the basemap's.
 */
import type { FillLayerSpec, MapScene, OverlayLayerSpec, PinsLayerSpec } from "../../domain/model/scene.ts";

export type GeoJson = { type: "FeatureCollection"; features: unknown[] };
export interface SourceDef { id: string; data: GeoJson; cluster?: boolean }
export interface LayerDef { id: string; type: string; source: string; filter?: unknown[]; paint: Record<string, unknown>; layout?: Record<string, unknown> }
export interface Built { sources: SourceDef[]; layers: LayerDef[]; /** Same key = same data, so only filters and paints need updating. */ dataKey: string }

export const IDS = { fill: "dd-fill", outline: "dd-outline", selected: "dd-selected", selectedHalo: "dd-selected-halo", clusters: "dd-clusters", clusterCount: "dd-cluster-count", pins: "dd-pins", overlayLines: "dd-overlay-lines", overlayPoints: "dd-overlay-points" } as const;
export const SOURCES = { fill: "dd-fill-src", pins: "dd-pins-src", overlay: "dd-overlay-src" } as const;
const FONT = ["Noto Sans Medium"];

function fill(spec: FillLayerSpec, overStreets: boolean): { sources: SourceDef[]; layers: LayerDef[]; key: string } {
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
  const data: GeoJson = { type: "FeatureCollection", features: spec.pins.map((p) => ({ type: "Feature", properties: { id: p.id, name: p.name, color: p.color, radius: p.radius }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) };
  const selected = spec.selectedId ?? "";
  const layers: LayerDef[] = [];
  const unclustered = spec.cluster ? ["!", ["has", "point_count"]] : undefined;
  if (spec.cluster) {
    layers.push(
      { id: IDS.clusters, type: "circle", source: SOURCES.pins, filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#93c5fd", 20, "#3b82f6", 100, "#1d4ed8"], "circle-radius": ["step", ["get", "point_count"], 14, 20, 20, 100, 28], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-opacity": spec.opacity } },
      { id: IDS.clusterCount, type: "symbol", source: SOURCES.pins, filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12 }, paint: { "text-color": "#0f172a" } },
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
  return { sources: [{ id: SOURCES.pins, data, cluster: spec.cluster }], layers, key: `pins:${spec.cluster}:${spec.pins.map((p) => `${p.id}~${p.color}~${p.radius}~${p.lng}~${p.lat}`).join("|")}` };
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

/** `overStreets`: a street basemap is under the boundaries, so the fill lets it show through. */
export function buildMapLibreLayers(scene: MapScene, overStreets = false): Built {
  const parts = scene.layers.map((l) => (l.kind === "FILL" ? fill(l, overStreets) : l.kind === "PINS" ? pins(l) : overlay(l)));
  return { sources: parts.flatMap((p) => p.sources), layers: parts.flatMap((p) => p.layers), dataKey: parts.map((p) => p.key).join("#") };
}

/** Layers a click can land on, top first: pins, then boundaries. */
export const PICKABLE: readonly string[] = [IDS.pins, IDS.fill];
