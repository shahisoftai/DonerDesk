"use client";

import { useEffect, useState } from "react";
import { unitFromFeature, type BoundaryUnit } from "../domain/boundaries/join";
import type { BoundarySource } from "../ports/boundary-source";

export interface ContextOutline { ref: string; name: string; geometry: unknown }
const outline = (u: BoundaryUnit): ContextOutline => ({ ref: u.ref, name: u.name, geometry: u.geometry });

/**
 * The outlines drawn under a sites map, so the dots have somewhere to sit: the organisation's own old uploaded layer when it has one,
 * else the country's provinces, else the world's countries. Only context: it never carries a figure. Empty while loading and when none can be read.
 */
export function useSiteContext(country: string | undefined, customLayerUrl: string | undefined, source: BoundarySource): ContextOutline[] {
  const [outlines, setOutlines] = useState<ContextOutline[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      if (customLayerUrl) {
        const response = await fetch(customLayerUrl, { headers: { accept: "application/json" } });
        if (response.ok) {
          const collection = (await response.json()) as { features?: unknown[] };
          const units = (collection.features ?? []).map((f) => unitFromFeature(f as Parameters<typeof unitFromFeature>[0])).filter((u): u is BoundaryUnit => u !== null);
          if (units.length > 0) return units;
        }
      }
      if (country) {
        const provinces = await source.load({ name: country }, 1);
        if (provinces && provinces.length > 0) return provinces;
        const world = (await source.load(null, 0)) ?? [];
        return world.filter((u) => u.name.toLowerCase() === country.toLowerCase());
      }
      return (await source.load(null, 0)) ?? [];
    })()
      .then((units) => { if (live) setOutlines(units.map(outline)); })
      .catch(() => { if (live) setOutlines([]); });
    return () => { live = false; };
  }, [country, customLayerUrl, source]);
  return outlines;
}
