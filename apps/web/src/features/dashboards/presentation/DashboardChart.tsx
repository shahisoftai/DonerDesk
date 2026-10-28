"use client";

import { useEffect, useRef } from "react";
import type * as echarts from "echarts";

/** One chart that fills the box it is given and redraws when the box changes size (a dragged corner, a rotated phone). */
export function DashboardChart({ option, label }: { option: Record<string, unknown>; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const latest = useRef(option);
  latest.current = option;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("echarts").then((mod) => {
      if (disposed || !ref.current) return;
      const chart = mod.init(ref.current);
      instance.current = chart;
      chart.setOption(latest.current, true);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(ref.current);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => { instance.current?.setOption(option, true); }, [option]);

  return <div ref={ref} role="img" aria-label={label} className="h-full w-full" />;
}
