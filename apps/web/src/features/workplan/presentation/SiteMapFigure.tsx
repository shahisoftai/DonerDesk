"use client";

import { useEffect, useRef, useState } from "react";
import type * as echarts from "echarts";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { SiteMapPoint } from "../domain/site-map";
import { isMapRegistered, loadCustomLayer, loadMapAssets, registerNamedMap } from "@/lib/client/map-assets";

/**
 * The map figure (Phase 30 §3, extended in 30.1): the only file that touches ECharts for reading.
 * The library, the geo assets, the gazetteer and the option builder load lazily, so the pages that
 * merely render this figure gain nothing in their first bundle; a workspace's uploaded boundaries
 * layer replaces the bundled world map when one exists; if anything fails to load, one plain
 * sentence says so and the caller's list still stands.
 */
export function SiteMapFigure({
  points,
  country,
  caption,
  customLayerUrl,
}: {
  points: readonly SiteMapPoint[];
  country?: string;
  caption?: string;
  customLayerUrl?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (points.length === 0) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { echarts: mod, world, admin1 } = await loadMapAssets();
      const usingCustom = customLayerUrl ? await loadCustomLayer(mod, customLayerUrl) : false;
      const { countryView, provincesOf, siteMapOption } = await import("../domain/site-map");
      if (disposed || !ref.current) return;
      if (!isMapRegistered("donordesk-world")) registerNamedMap(mod, "donordesk-world", world);
      const focus = usingCustom || !country ? null : countryView(world, country);
      const provinces = usingCustom || !country ? null : provincesOf(admin1, country);
      if (provinces) registerNamedMap(mod, "donordesk-provinces", provinces);
      const chart = instance.current ?? mod.init(ref.current);
      instance.current = chart;
      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        chart.dispose();
        instance.current = null;
      };
      chart.setOption(siteMapOption(points, { focus, provinces, ...(usingCustom ? { baseMap: "donordesk-custom" } : {}) }), true);
    })().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [points, country, customLayerUrl]);

  if (points.length === 0) return null;
  if (failed) {
    return (
      <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
        {WORKPLAN_COPY.mapUnavailable}
      </p>
    );
  }
  return (
    <figure className="my-1 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div ref={ref} className="h-80 w-full" role="img" aria-label={caption ?? WORKPLAN_COPY.mapCaption} />
      {caption && <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">{caption}</figcaption>}
    </figure>
  );
}
