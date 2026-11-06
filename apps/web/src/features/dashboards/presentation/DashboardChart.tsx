"use client";

import { useEffect, useRef } from "react";
import type * as echarts from "echarts";
import { retheme } from "@donordesk/domain/contexts/reporting/chart-theme-roles.js";
import { prepareChartMaps } from "@/lib/client/chart-maps";
import { chartTheme, chartThemeName, rolesFor } from "@/features/design/domain/chart-theme";
import { useRenderWhenSeen } from "@/features/design/presentation/render-when-seen";
import { useColorMode } from "@/features/design/presentation/use-color-mode";

const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** One chart that fills the box it is given and redraws when the box changes size (a dragged corner, a rotated phone). */
export function DashboardChart({ option, label, maps, regionNames, onPick, hoverName, onHover }: {
  /** The label being pointed at in another chart; this chart highlights the same one. */
  hoverName?: string | null | undefined;
  /** Reports the label under the pointer (null when it leaves). */
  onHover?: ((name: string | null) => void) | undefined; option: Record<string, unknown>; label: string; maps?: string[] | undefined; regionNames?: string[] | undefined; /** A click on a bar, point or slice reports its label; the dashboard decides what that means. */ onPick?: ((name: string) => void) | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useColorMode();
  const seen = useRenderWhenSeen(ref);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const instance = useRef<echarts.ECharts | null>(null);
  const latest = useRef(option);
  latest.current = option;
  const pick = useRef(onPick);
  pick.current = onPick;
  const hover = useRef(onHover);
  hover.current = onHover;

  useEffect(() => {
    if (!seen) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void (async () => {
      // A map chart needs its map registered first (the bundled geography, loaded when first needed).
      const prepared = await prepareChartMaps(maps, regionNames);
      const mod = prepared?.echarts ?? (await import("echarts"));
      if (disposed || !ref.current) return;
      mod.registerTheme(chartThemeName("light"), chartTheme("light"));
      mod.registerTheme(chartThemeName("dark"), chartTheme("dark"));
      const chart = mod.init(ref.current, chartThemeName(modeRef.current));
      instance.current = chart;
      chart.on("click", (params: unknown) => {
        const name = (params as { name?: unknown }).name;
        if (typeof name === "string" && name !== "") pick.current?.(name);
      });
      chart.on("mouseover", (params: unknown) => {
        const name = (params as { name?: unknown }).name;
        if (typeof name === "string" && name !== "") hover.current?.(name);
      });
      chart.on("globalout", () => hover.current?.(null));
      chart.setOption({ ...retheme(latest.current, rolesFor(modeRef.current)), ...(reducedMotion() ? { animation: false } : {}) }, true);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(ref.current);
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      instance.current?.dispose();
      instance.current = null;
    };
  }, [mode, seen]);

  // A change of colour mode needs a new instance (the library fixes a theme at creation), so the chart is rebuilt by the effect above.
  useEffect(() => { instance.current?.setOption({ ...retheme(option, rolesFor(modeRef.current)), animation: false }, true); }, [option]);

  // Another chart is being pointed at: show the same label here (a category by its position, a named slice or region by name).
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    chart.dispatchAction({ type: "downplay" });
    if (!hoverName) return;
    const axis = (option as { xAxis?: { data?: unknown[] } | Array<{ data?: unknown[] }> }).xAxis;
    const cats = (Array.isArray(axis) ? axis[0] : axis)?.data;
    const index = Array.isArray(cats) ? cats.findIndex((c) => String(c) === hoverName) : -1;
    chart.dispatchAction(index >= 0 ? { type: "highlight", dataIndex: index } : { type: "highlight", name: hoverName });
  }, [hoverName, option]);

  return <div ref={ref} role="img" aria-label={label} className="h-full w-full" />;
}
