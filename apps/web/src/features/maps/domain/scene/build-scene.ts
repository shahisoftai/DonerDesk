/**
 * The results map as a scene: boundaries coloured by the joined place's figure, pins sized by their figure, an optional file layer.
 * Pure. Rules carried over from the ECharts explorer: a place with no figure is grey (never 0); a pin only where a place has coordinates;
 * a boundary that matches no place is drawn grey and says so; nothing is guessed onto the map.
 */
import type { BasemapMode, FillLayerSpec, LayerSpec, MapScene, PinFeature, Tip } from "../model/scene.ts";
import { pinTipKey } from "../model/scene.ts";
import { geometryBounds, pointBounds, unionBounds } from "../model/bounds.ts";
import type { JoinedUnit } from "../boundaries/join.ts";
import { NO_DATA_COLOR, colorFor, layerState, type ExplorerLayer, type ExplorerModel, type MapRegion } from "../map-explorer.ts";
import type { Overlay } from "../overlay-layer.ts";

export interface ResultsSceneInput {
  model: ExplorerModel;
  layers: readonly ExplorerLayer[];
  joined: readonly JoinedUnit[];
  unit: string | null;
  selectedRef: string | null;
  selectedPlaceId: string | null;
  overlay?: Overlay | null | undefined;
  basemap: BasemapMode;
  /** The language of the map's own place names (the basemap's labels). */
  lang?: string;
  /** What a screen reader says for the whole map, already in the person's language. */
  label: string;
  cluster?: boolean;
}

const figure = (display: string | null, unit: string | null, verified: boolean): string =>
  display === null ? "Not measured" : `${display}${unit ? ` ${unit}` : ""}${verified ? "" : " (not verified yet)"}`;

export function buildResultsScene(input: ResultsSceneInput): MapScene {
  const { model, layers, joined, unit, selectedRef, selectedPlaceId, overlay, basemap } = input;
  const fill = layerState(layers, "FILL");
  const symbols = layerState(layers, "SYMBOLS");
  const outline = layerState(layers, "BOUNDARIES");
  const over = layerState(layers, "OVERLAY");
  const regionByPlace = new Map<string, MapRegion>(model.regions.map((r) => [r.placeId, r]));
  const tips: Record<string, Tip> = {};
  const out: LayerSpec[] = [];

  const fillLayer: FillLayerSpec = {
    kind: "FILL",
    opacity: fill.visible ? fill.opacity : 0.15,
    outline: outline.visible,
    selectedRef,
    features: joined.map((j) => {
      const region = j.placeId ? regionByPlace.get(j.placeId) : undefined;
      const color = fill.visible ? colorFor(region?.value ?? null, model.bands) : NO_DATA_COLOR;
      const lines = region ? [region.path, figure(region.display, unit, region.verified), ...(j.basis === "NAME" ? ["Matched by name only"] : [])] : ["Not measured"];
      tips[j.unit.ref] = { title: j.unit.name, lines: lines.filter((l) => l && l !== j.unit.name) };
      return { ref: j.unit.ref, name: j.unit.name, color, geometry: j.unit.geometry };
    }),
  };
  out.push(fillLayer);

  const pins: PinFeature[] = [];
  if (symbols.visible) {
    const max = Math.max(1, ...model.pins.map((p) => p.value ?? 0));
    for (const p of model.pins) {
      pins.push({ id: p.placeId, name: p.name, lng: p.lng, lat: p.lat, color: p.value === null ? NO_DATA_COLOR : "#b45309", radius: p.value === null ? 5 : 6 + Math.sqrt(p.value / max) * 14 });
      tips[pinTipKey(p.placeId)] = { title: p.name, lines: [p.path !== p.name ? p.path : "", figure(p.display, unit, p.verified)].filter(Boolean) };
    }
    out.push({ kind: "PINS", pins, opacity: symbols.opacity, selectedId: selectedPlaceId, cluster: input.cluster ?? pins.length > 200 });
  }
  if (overlay && over.visible) out.push({ kind: "OVERLAY", points: overlay.points, lines: overlay.lines, opacity: over.opacity });

  const bounds = unionBounds([
    ...fillLayer.features.map((f) => geometryBounds(f.geometry)),
    ...pins.map((p) => pointBounds(p.lng, p.lat)),
  ]);
  return { label: input.label, basemap, ...(input.lang ? { lang: input.lang } : {}), bounds, layers: out, tips };
}
