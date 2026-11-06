/**
 * Which self-hosted basemap file covers a view. Pure. A view is covered only when all of it lies inside a region's box:
 * a world view, or one that straddles two regions, shows boundaries over a plain ground rather than half a street map.
 * Adding a region = a row here + a file built by `scripts/maps/extract-basemap.sh`.
 */
import type { Bounds } from "../model/scene.ts";

export interface BasemapRegion { id: string; file: string; bounds: Bounds; label: string }

export const BASEMAP_REGIONS: readonly BasemapRegion[] = [
  { id: "africa", file: "basemap-africa.pmtiles", bounds: [-18, -12, 52, 24], label: "Africa, the Sahel and the Horn" },
  { id: "southasia", file: "basemap-southasia.pmtiles", bounds: [60, 5, 98, 38], label: "South Asia" },
];

const inside = (view: Bounds, box: Bounds): boolean => view[0] >= box[0] && view[1] >= box[1] && view[2] <= box[2] && view[3] <= box[3];

export function basemapRegionFor(view: Bounds | null, regions: readonly BasemapRegion[] = BASEMAP_REGIONS): BasemapRegion | null {
  if (!view) return null;
  return regions.find((r) => inside(view, r.bounds)) ?? null;
}

/** Said when a view has no street basemap: a code, so the screen can say it in the person's language (`maps.noBasemap`). */
export const NO_BASEMAP = "NO_BASEMAP" as const;
export type BasemapNote = typeof NO_BASEMAP;
