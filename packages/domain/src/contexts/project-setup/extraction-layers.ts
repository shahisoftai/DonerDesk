/**
 * Which areas can be read at the same time (Phase 36): an area waits only for the areas it depends on (`SETUP_AREAS`), so the
 * rest run together. Layer 0 has no dependencies, layer 1 depends only on layer 0, and so on; inside a layer areas keep the
 * apply order. Only registered areas count: a dependency nobody extracts does not hold anything up. Pure.
 */
import { SETUP_AREAS, SETUP_AREA_APPLY_ORDER, type SetupAreaKey } from "./proposal-areas.js";

export function extractionLayers(areas: ReadonlyArray<SetupAreaKey>): SetupAreaKey[][] {
  const present = new Set(areas);
  const levelOf = new Map<SetupAreaKey, number>();
  const level = (area: SetupAreaKey): number => {
    const known = levelOf.get(area);
    if (known !== undefined) return known;
    const deps = SETUP_AREAS[area].dependsOn.filter((d) => present.has(d));
    const result = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(level));
    levelOf.set(area, result);
    return result;
  };
  const layers: SetupAreaKey[][] = [];
  for (const area of SETUP_AREA_APPLY_ORDER) {
    if (!present.has(area)) continue;
    (layers[level(area)] ??= []).push(area);
  }
  return layers.filter((l) => l.length > 0);
}
