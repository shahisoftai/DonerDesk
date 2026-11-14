"use client";

import { useEffect, useRef } from "react";
import type * as echarts from "echarts";

/**
 * Draws one ECharts option filling its box, and reports a click on a category, slice or bar (for slicing). ECharts loads only when a
 * dataset chart is on the page.
 */
export function DataChart({ option, label, onPick }: { option: Record<string, unknown>; label: string; onPick?: ((name: string) => void) | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const latest = useRef(option);
  latest.current = option;
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let gone = false;
    let stop: (() => void) | undefined;
    void import("echarts").then((mod) => {
      if (gone || !ref.current) return;
      const c = mod.init(ref.current);
      chart.current = c;
      c.setOption(latest.current, true);
      c.on("click", (e: { name?: string }) => { if (e.name) pick.current?.(e.name); });
      const ro = new ResizeObserver(() => c.resize());
      ro.observe(ref.current);
      stop = () => { ro.disconnect(); c.dispose(); chart.current = null; };
    });
    return () => { gone = true; stop?.(); };
  }, []);
  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  return <div ref={ref} className="h-full min-h-40 w-full" role="img" aria-label={label} />;
}
