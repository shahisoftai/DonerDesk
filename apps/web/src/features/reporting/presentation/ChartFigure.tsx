"use client";

import { useEffect, useRef } from "react";
import type * as echarts from "echarts";
import { buildChartOption, optionFromResolved, type ChartConfig, type ResolvedChartData } from "@donordesk/domain/contexts/reporting/chart-config.js";

export type ChartFigureIndicator = {
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  achievement: string;
  status: string;
};

/**
 * Read-only rendering of a section's hand-made chart inside the report document. The chart editor (type, data binding) lives in
 * the inspector's Chart tab; this component only draws what is configured. ECharts is loaded lazily.
 */
export function ChartFigure({
  config,
  indicators,
  caption,
}: {
  config: ChartConfig;
  indicators: ChartFigureIndicator[];
  caption?: string;
}) {
  return <EChartFigure option={buildChartOption(indicators, config)} caption={caption} />;
}

/** A chart drawn from a table of its section (a stored CHART artifact): the dataset is already resolved, so it is drawn as is. */
export function ResolvedChartFigure({ resolved, caption }: { resolved: ResolvedChartData; caption?: string }) {
  return <EChartFigure option={optionFromResolved(resolved, resolved.type)} caption={caption} />;
}

function EChartFigure({ option, caption }: { option: Record<string, unknown>; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const latest = useRef(option);
  latest.current = option;

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("echarts").then((mod) => {
      if (disposed || !ref.current) return;
      const chart = mod.init(ref.current);
      instance.current = chart;
      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        chart.dispose();
        instance.current = null;
      };
      chart.setOption(latest.current, true);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    instance.current?.setOption(option, true);
  }, [option]);

  return (
    <figure className="my-4 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div ref={ref} className="h-64 w-full" role="img" aria-label={caption ?? "Report chart"} />
      {caption && <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">{caption}</figcaption>}
    </figure>
  );
}
