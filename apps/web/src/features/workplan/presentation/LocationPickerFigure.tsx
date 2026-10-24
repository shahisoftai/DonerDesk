"use client";

import { useEffect, useRef, useState } from "react";
import type * as echarts from "echarts";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { loadCustomLayer, loadMapAssets, registerNamedMap } from "@/lib/client/map-assets";

/**
 * Click-to-pin for a place the gazetteer does not know (Phase 30.1): a small map — the workspace's
 * uploaded boundaries when there are any, the world otherwise — where clicking drops the pin, and
 * the coordinates it produces. It never writes: the pin exists only once the form is saved.
 */
export function LocationPickerFigure({
  value,
  country,
  customLayerUrl,
  onChange,
}: {
  value: { latitude: number; longitude: number } | null;
  country?: string;
  customLayerUrl?: string;
  onChange: (value: { latitude: number; longitude: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { echarts: mod, world } = await loadMapAssets();
      const usingCustom = customLayerUrl ? await loadCustomLayer(mod, customLayerUrl) : false;
      if (disposed || !ref.current) return;
      const mapName = usingCustom ? "donordesk-custom" : "donordesk-picker-world";
      if (mapName === "donordesk-picker-world" && !mod.getMap(mapName)) registerNamedMap(mod, mapName, world);
      const chart = instance.current ?? mod.init(ref.current);
      instance.current = chart;
      chart.setOption(
        {
          animation: false,
          tooltip: { show: false },
          geo: {
            map: mapName,
            roam: true,
            scaleLimit: { min: 0.8, max: 40 },
            layoutCenter: ["50%", "50%"],
            layoutSize: "100%",
            itemStyle: { areaColor: "#e2e8f0", borderColor: "#64748b", borderWidth: 0.8 },
            emphasis: { label: { show: false } },
            select: { disabled: true },
          },
          series: [
            {
              type: "scatter",
              coordinateSystem: "geo",
              data: value ? [{ name: WORKPLAN_COPY.mapPinned, value: [value.longitude, value.latitude], itemStyle: { color: "#dc2626" } }] : [],
              symbolSize: 14,
              emphasis: { scale: 1.2 },
              select: { disabled: true },
            },
          ],
        },
        true,
      );
      chart.getZr().off("click");
      // Any click on the map places the pin there — the geo background is itself a target, so there
      // is no "empty area" to test for. Clicking an existing pin simply re-pins that spot.
      chart.getZr().on("click", (event) => {
        const coords = chart.convertFromPixel({ geoIndex: 0 }, [event.offsetX, event.offsetY]);
        if (!coords) return;
        const lng = coords[0];
        const lat = coords[1];
        if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onChangeRef.current({ latitude: Math.round(lat * 10000) / 10000, longitude: Math.round(lng * 10000) / 10000 });
      });
      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        chart.dispose();
        instance.current = null;
      };
    })().catch((error) => {
      console.error("PICKER_SETUP_FAILED", error instanceof Error ? error.message : error);
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
    // The chart's own state (marker) re-renders through setOption; the picker is remounted by the form when it reopens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLayerUrl]);

  // The pin moves as the value changes (from a click, from the number fields, or when cleared).
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    chart.setOption(
      {
        series: [
          {
            data: value
              ? [{ name: WORKPLAN_COPY.mapPinned, value: [value.longitude, value.latitude], itemStyle: { color: "#dc2626" } }]
              : [],
          },
        ],
      },
      false,
    );
  }, [value]);

  if (failed) {
    return (
      <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
        {WORKPLAN_COPY.mapUnavailable}
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
      <div ref={ref} className="h-56 w-full cursor-crosshair" role="application" aria-label={WORKPLAN_COPY.pinHint} />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{WORKPLAN_COPY.pinHint}</p>
    </div>
  );
}
