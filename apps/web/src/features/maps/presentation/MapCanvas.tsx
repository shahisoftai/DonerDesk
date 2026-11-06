"use client";

import { useEffect, useRef, useState } from "react";
import type * as echarts from "echarts";
import type { NamedGeoCollection } from "../../workplan/domain/geo/geo-types";
import { loadMapAssets, registerNamedMap } from "@/lib/client/map-assets";

export interface MapRegistration {
  name: string;
  collection: NamedGeoCollection;
}

/**
 * The one adapter between the explorer and ECharts: registers the maps it is given, draws the option it is given
 * and reports a click as a region name or a pin's place id. It decides nothing about colour, size or meaning.
 */
export function MapCanvas({ option, registrations, onRegion, onPin, label, height = "h-[28rem]" }: {
  option: Record<string, unknown>;
  registrations: readonly MapRegistration[];
  onRegion: (name: string) => void;
  onPin: (placeId: string) => void;
  label: string;
  /** A Tailwind height class: the small-multiple panels are shorter. */
  height?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const handlers = useRef({ onRegion, onPin });
  handlers.current = { onRegion, onPin };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const { echarts: mod } = await loadMapAssets();
      if (disposed || !ref.current) return;
      for (const r of registrations) registerNamedMap(mod, r.name, r.collection);
      if (!chart.current) {
        const instance = mod.init(ref.current);
        instance.on("click", (params: unknown) => {
          const p = params as { componentType?: string; name?: string; data?: { placeId?: string } };
          if (p.data?.placeId) handlers.current.onPin(p.data.placeId);
          else if (p.componentType === "geo" && p.name) handlers.current.onRegion(p.name);
        });
        chart.current = instance;
      }
      chart.current.setOption(option, true);
    })().catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [option, registrations]);

  useEffect(() => {
    const onResize = () => chart.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.current?.dispose(); chart.current = null; };
  }, []);

  if (failed) return <p role="alert" className="rounded-lg border p-3 text-sm">The map could not be loaded. The list of places is still below.</p>;
  return <div ref={ref} className={`${height} w-full`} role="img" aria-label={label} />;
}
