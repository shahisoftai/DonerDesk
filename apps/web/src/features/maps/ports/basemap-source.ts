import type { BasemapNote } from "../domain/basemap/regions.ts";
import type { BasemapMode, Bounds } from "../domain/model/scene.ts";

export interface BasemapStyle {
  /** A MapLibre style specification (opaque here). */
  style: unknown;
  /** Stable key: the same key means the same ground, so the renderer need not reload it. */
  key: string;
  /** The region file used, or null for the plain ground. */
  regionId: string | null;
  note: BasemapNote | null;
}

export interface BasemapSource {
  /** `lang`: the language of the map's own place names ("en", "fr", "es", "ar"); English when absent. */
  styleFor(mode: BasemapMode, view: Bounds | null, lang?: string): BasemapStyle;
}
