/**
 * Which self-hosted basemap file covers a view. Pure. A detailed region is used only when all of the view lies inside its box; anywhere else
 * (a world view, a view across two regions, a country with no detailed region) the low-zoom world file is used, so every country has a ground
 * (Phase 49.2). Adding a region = a row here + a file built by `scripts/maps/extract-basemap.sh <id>` (which reads the same boxes from
 * `scripts/maps/basemap-regions.json`; `basemap-regions.test.mts` keeps the two in step).
 */
import type { Bounds } from "../model/scene.ts";

export interface BasemapRegion {
  id: string;
  file: string;
  bounds: Bounds;
  label: string;
  /** The deepest zoom the file holds; MapLibre over-zooms past it. */
  maxzoom: number;
  /** The Protomaps build the file was cut from (YYYYMMDD), shown on the sources page. */
  built: string;
}

/** The whole world at low detail (z0–6, ~120 MB): the ground wherever no detailed region covers the view. */
export const WORLD_BASEMAP: BasemapRegion = { id: "world", file: "basemap-world.pmtiles", bounds: [-180, -85, 180, 85], label: "The world (low detail)", maxzoom: 6, built: "20261110" };

/** Detailed regions (z0–14), kept on the host only where live projects are (`scripts/maps/basemap-regions.mjs` says which). */
export const BASEMAP_REGIONS: readonly BasemapRegion[] = [
  { id: "africa", file: "basemap-africa.pmtiles", bounds: [-18, -12, 52, 24], label: "Africa, the Sahel and the Horn", maxzoom: 12, built: "20261103" },
  { id: "southasia", file: "basemap-southasia.pmtiles", bounds: [60, 5, 98, 38], label: "South Asia", maxzoom: 12, built: "20261103" },
  { id: "mena", file: "basemap-mena.pmtiles", bounds: [25, 12, 63, 42], label: "The Middle East (Syria, Iraq, Lebanon, Jordan, Palestine, Yemen)", maxzoom: 12, built: "20261110" },
  { id: "easteurope", file: "basemap-easteurope.pmtiles", bounds: [20, 43, 42, 53], label: "Eastern Europe (Ukraine, Moldova)", maxzoom: 12, built: "20261110" },
  { id: "caribbean", file: "basemap-caribbean.pmtiles", bounds: [-86, 9, -59, 24], label: "The Caribbean (Haiti, Dominican Republic, Cuba)", maxzoom: 12, built: "20261110" },
  { id: "andes", file: "basemap-andes.pmtiles", bounds: [-82, -19, -59, 13], label: "Colombia, Venezuela, Ecuador and Peru", maxzoom: 12, built: "20261110" },
  { id: "southeastasia", file: "basemap-southeastasia.pmtiles", bounds: [92, -11, 128, 29], label: "Southeast Asia (Myanmar, the Philippines, Indonesia)", maxzoom: 12, built: "20261110" },
];

const inside = (view: Bounds, box: Bounds): boolean => view[0] >= box[0] && view[1] >= box[1] && view[2] <= box[2] && view[3] <= box[3];
const area = (b: Bounds): number => (b[2] - b[0]) * (b[3] - b[1]);

/** The smallest detailed region that holds the whole view, or null. */
export function basemapRegionFor(view: Bounds | null, regions: readonly BasemapRegion[] = BASEMAP_REGIONS): BasemapRegion | null {
  if (!view) return null;
  const holding = regions.filter((r) => inside(view, r.bounds));
  return holding.sort((a, b) => area(a.bounds) - area(b.bounds))[0] ?? null;
}

/** The file to draw: a detailed region when one holds the view, else the world file (null only when no world file is configured). */
export function basemapFileFor(view: Bounds | null, regions: readonly BasemapRegion[] = BASEMAP_REGIONS, world: BasemapRegion | null = WORLD_BASEMAP): BasemapRegion | null {
  return basemapRegionFor(view, regions) ?? world;
}

/** Said when a view has no street basemap: a code, so the screen can say it in the person's language (`maps.noBasemap`). */
export const NO_BASEMAP = "NO_BASEMAP" as const;
/** Said when only the low-detail world ground covers the view: streets and towns appear only in the detailed regions (`maps.lowDetailBasemap`). */
export const LOW_DETAIL_BASEMAP = "LOW_DETAIL_BASEMAP" as const;
export type BasemapNote = typeof NO_BASEMAP | typeof LOW_DETAIL_BASEMAP;
