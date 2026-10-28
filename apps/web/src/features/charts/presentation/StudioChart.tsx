"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { prepareChartMaps } from "@/lib/client/chart-maps";

/** What the studio can take out of the drawn chart for a download. */
export interface ChartExport { png(): string | null; svg(): string | null }

type EChartsModule = typeof import("echarts");

/** One chart that fills its box at a fixed shape and redraws when the box changes size. ECharts is loaded when a chart is first drawn. */
export function StudioChart({ option, aspect, label, exportRef, maps, regionNames, onMissingRegions }: { option: Record<string, unknown>; aspect: number; label: string; exportRef: MutableRefObject<ChartExport | null>; maps?: string[] | undefined; regionNames?: string[] | undefined; onMissingRegions?: ((names: string[]) => void) | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const instance = useRef<import("echarts").ECharts | null>(null);
  const lib = useRef<EChartsModule | null>(null);
  const latest = useRef(option);
  latest.current = option;

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
      const chart = mod.init(box.current);
      instance.current = chart;
      chart.setOption(latest.current, true);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(box.current);
    })();
    exportRef.current = {
      png: () => instance.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" }) ?? null,
      svg: () => {
        const mod = lib.current;
        if (!mod) return null;
        // A second, off-screen chart drawn with the SVG renderer from the same option: the file is the picture on screen.
        const width = 1000;
        const chart = mod.init(null, null, { renderer: "svg", ssr: true, width, height: Math.round(width / aspect) });
        chart.setOption({ ...latest.current, animation: false });
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
  }, []);

  useEffect(() => { instance.current?.setOption(option, true); }, [option]);

  return <div ref={box} role="img" aria-label={label} data-testid="chart-canvas" style={{ aspectRatio: String(aspect), maxHeight: 560 }} className="w-full" />;
}
