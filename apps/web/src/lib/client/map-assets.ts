"use client";

import type * as echarts from "echarts";
import type { NamedGeoCollection } from "../../features/workplan/domain/geo/geo-types";

/**
 * The one place that loads ECharts and the geo assets (Phase 30.1): the site map figure and the
 * location picker both draw through it, so the heavy library and data load once per session and
 * never enter a first bundle. A workspace's uploaded layer is fetched by URL and registered over
 * the bundled world map.
 */
export interface MapAssets {
  echarts: typeof import("echarts");
  world: NamedGeoCollection;
  admin1: NamedGeoCollection;
}

let assets: Promise<MapAssets> | undefined;

export function loadMapAssets(): Promise<MapAssets> {
  return (assets ??= Promise.all([
    import("echarts"),
    import("../../features/workplan/domain/geo/world-geo"),
    import("../../features/workplan/domain/geo/admin1-geo"),
  ]).then(([mod, world, admin1]) => ({ echarts: mod, world: world.WORLD_GEO, admin1: admin1.ADMIN1_GEO })));
}

const REGISTERED = new Set<string>();

/** Registers a named GeoJSON (readonly by our types; ECharts validates its own shape). */
export function registerNamedMap(mod: typeof import("echarts"), name: string, collection: NamedGeoCollection): void {
  mod.registerMap(name, collection as unknown as Parameters<typeof mod.registerMap>[1]);
  REGISTERED.add(name);
}

export function isMapRegistered(name: string): boolean {
  return REGISTERED.has(name);
}

/** Fetches the workspace's uploaded GeoJSON (same-origin, session cookie) and registers it. */
export async function loadCustomLayer(mod: typeof import("echarts"), url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) return false;
    const collection = (await response.json()) as NamedGeoCollection;
    if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length === 0) return false;
    registerNamedMap(mod, "donordesk-custom", collection);
    return true;
  } catch {
    return false;
  }
}
