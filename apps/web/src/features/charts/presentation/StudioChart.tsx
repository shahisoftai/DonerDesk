"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { StyleGroup } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { prepareChartMaps } from "@/lib/client/chart-maps";
import { chartTheme, chartThemeName } from "@/features/design/domain/chart-theme";
import { useColorMode } from "@/features/design/presentation/use-color-mode";
import { groupOfEvent } from "../domain/studio-style";

/** What the studio can take out of the drawn chart for a download. */
export interface ChartExport { png(): string | null; svg(): string | null }

type EChartsModule = typeof import("echarts");

/**
 * One chart that fills its box at a fixed shape and redraws when the box changes size. ECharts is loaded when a chart is first drawn.
 * `option` is what the screen shows (it may carry zoom bars and a toolbox); `exportOption` is the same chart as a file carries it, so a
 * download never has them. A click on a part of the picture reports which group of style options it belongs to.
 */
export function StudioChart({ option, exportOption, aspect, label, exportRef, maps, regionNames, onMissingRegions, onElement }: { option: Record<string, unknown>; exportOption?: Record<string, unknown> | undefined; aspect: number; label: string; exportRef: MutableRefObject<ChartExport | null>; maps?: string[] | undefined; regionNames?: string[] | undefined; onMissingRegions?: ((names: string[]) => void) | undefined; onElement?: ((group: StyleGroup) => void) | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const instance = useRef<import("echarts").ECharts | null>(null);
  const lib = useRef<EChartsModule | null>(null);
  const latest = useRef(option);
  latest.current = option;
  const forFile = useRef(exportOption ?? option);
  forFile.current = exportOption ?? option;
  const picked = useRef(onElement);
  picked.current = onElement;
  const mode = useColorMode();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void (async () => {
      // A map chart needs its map registered first; a country the map does not know is reported.
      const prepared = await prepareChartMaps(maps, regionNames);
      if (prepared) onMissingRegions?.(prepared.missing);
      const mod = prepared?.echarts ?? (await import("echarts"));
      if (disposed || !box.current) return;
      lib.current = mod;
      mod.registerTheme(chartThemeName("light"), chartTheme("light"));
      mod.registerTheme(chartThemeName("dark"), chartTheme("dark"));
      const chart = mod.init(box.current, chartThemeName(modeRef.current));
      instance.current = chart;
      chart.on("click", (p: unknown) => { const g = groupOfEvent(p as Parameters<typeof groupOfEvent>[0]); if (g) picked.current?.(g); });
      chart.setOption(latest.current, true);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(box.current);
    })();
    exportRef.current = {
      // A second, off-screen chart drawn from the file's own option: a download is the picture without zoom bars or buttons.
      png: () => {
        const mod = lib.current;
        if (!mod) return null;
        const width = 1000;
        const chart = mod.init(document.createElement("div"), null, { renderer: "canvas", width, height: Math.round(width / aspect) });
        chart.setOption({ ...forFile.current, animation: false });
        const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
        chart.dispose();
        return url;
      },
      svg: () => {
        const mod = lib.current;
        if (!mod) return null;
        const width = 1000;
        const chart = mod.init(null, null, { renderer: "svg", ssr: true, width, height: Math.round(width / aspect) });
        chart.setOption({ ...forFile.current, animation: false });
        const svg = chart.renderToSVGString();
        chart.dispose();
        return svg;
      },
    };
    return () => {
      disposed = true;
      observer?.disconnect();
      instance.current?.dispose();
      instance.current = null;
      exportRef.current = null;
    };
    // The export functions read the latest option and aspect through refs; they are installed once per chart box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => { instance.current?.setOption(option, true); }, [option]);

  return <div ref={box} role="img" aria-label={label} data-testid="chart-canvas" style={{ aspectRatio: String(aspect), maxHeight: 560 }} className="w-full" />;
}
