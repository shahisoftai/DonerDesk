/**
 * What a map looks like when nobody has changed anything (Phase 53.1). The look is one table: ground, how areas are coloured and labelled,
 * borders and the legend. A saved choice wins field by field (`resolveMapLook`); a preset is only the answer to "nothing was chosen".
 * A new look is a new row; nothing branches on a preset id. Pure.
 */
import { DEFAULT_GROUND, isMapGround, type MapGround } from "./ground.ts";
import type { AreaColorBy, AreaLabels } from "./scene/area-style.ts";

export type MapPresetId = "REPORT" | "FIELD";

export interface MapPreset {
  id: MapPresetId;
  ground: MapGround;
  colorBy: AreaColorBy;
  labels: AreaLabels;
  legend: boolean;
}

export const MAP_PRESETS: Readonly<Record<MapPresetId, MapPreset>> = {
  REPORT: { id: "REPORT", ground: "SIMPLE", colorBy: "VALUE", labels: "AUTO", legend: true },
  FIELD: { id: "FIELD", ground: "STREETS", colorBy: "VALUE", labels: "NAME", legend: true },
};

export const DEFAULT_MAP_PRESET: MapPresetId = "REPORT";
export const MAP_PRESET_IDS = Object.keys(MAP_PRESETS) as MapPresetId[];

export interface SavedLook { ground?: unknown; colorBy?: AreaColorBy | undefined; labels?: AreaLabels | undefined; legend?: boolean | undefined }
export interface MapLook { ground: MapGround; colorBy: AreaColorBy; labels: AreaLabels; legend: boolean }

/** The look a map draws with: each saved field wins, anything unset or unknown comes from the preset. */
export function resolveMapLook(saved: SavedLook | undefined, preset: MapPresetId = DEFAULT_MAP_PRESET): MapLook {
  const base = MAP_PRESETS[preset];
  return {
    ground: isMapGround(saved?.ground) ? saved.ground : base.ground ?? DEFAULT_GROUND,
    colorBy: saved?.colorBy ?? base.colorBy,
    labels: saved?.labels ?? base.labels,
    legend: saved?.legend ?? base.legend,
  };
}
