"use client";

import { isMapRegistered, loadMapAssets, registerNamedMap } from "@/lib/client/map-assets";

/** The name the chart builder gives the bundled world map (the site map registers the same one). */
export const WORLD_MAP = "donordesk-world";

/**
 * Registers the maps a chart needs before it is drawn (loaded when first needed, never in a first bundle) and returns the region names
 * the map does not know, so a country that cannot be coloured is said, never dropped silently.
 */
export async function prepareChartMaps(maps: ReadonlyArray<string> | undefined, regionNames: ReadonlyArray<string> | undefined): Promise<{ echarts: typeof import("echarts"); missing: string[] } | null> {
  if (!maps || maps.length === 0) return null;
  const { echarts, world } = await loadMapAssets();
  if (maps.includes(WORLD_MAP) && !isMapRegistered(WORLD_MAP)) registerNamedMap(echarts, WORLD_MAP, world);
  const known = new Set(world.features.map((f) => String((f.properties as { name?: unknown } | undefined)?.name ?? "")));
  return { echarts, missing: (regionNames ?? []).filter((n) => !known.has(n)) };
}
