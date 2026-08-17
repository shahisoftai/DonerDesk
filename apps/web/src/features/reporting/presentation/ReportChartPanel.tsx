"use client";

import { useEffect, useRef, useState } from "react";
import type * as echarts from "echarts";
import { buildChartOption, type ChartConfig } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { updateReportSectionChartAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { useActionState } from "@/lib/client/action-state";

type ChartIndicator = {
  code: string;
  name: string;
  baseline: string;
  target: string;
  unit?: string;
  achievement: string;
  status: string;
};

const CHART_TYPES = [
  ["BAR", "Bar"],
  ["LINE", "Line"],
  ["PIE", "Pie"],
  ["AREA", "Area"],
  ["RADAR", "Radar"],
  ["GAUGE", "Gauge"],
] as const;

const BINDINGS = [
  ["INDICATOR_COMPARISON", "Baseline vs target vs achievement"],
  ["INDICATOR_ACHIEVEMENT", "Achievement vs target"],
  ["STATUS_DISTRIBUTION", "Status distribution"],
] as const;

export function ReportChartPanel({
  sectionId,
  initialConfig,
  expectedVersion,
  indicators,
  readOnly,
  onReload,
}: {
  sectionId: string;
  initialConfig: ChartConfig | null;
  expectedVersion: string;
  indicators: ChartIndicator[];
  readOnly: boolean;
  onReload: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [config, setConfig] = useState<ChartConfig | null>(initialConfig);
  const [saving, setSaving] = useState(false);
  const actionState = useActionState();

  // Lazy-load ECharts only when the panel is mounted.
  useEffect(() => {
    let cancelled = false;
    void import("echarts").then((mod) => {
      if (cancelled || !chartRef.current) return;
      chartInstance.current = mod.init(chartRef.current);
      if (config) {
        chartInstance.current.setOption(buildChartOption(indicators, config));
      }
      const onResize = () => chartInstance.current?.resize();
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        chartInstance.current?.dispose();
        chartInstance.current = null;
      };
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render whenever config or data changes.
  useEffect(() => {
    if (chartInstance.current && config) {
      chartInstance.current.setOption(buildChartOption(indicators, config), true);
    }
  }, [config, indicators]);

  async function persist(next: ChartConfig) {
    if (readOnly || saving) return;
    setSaving(true);
    setConfig(next);
    try {
      const result = await actionState.run(() => updateReportSectionChartAction(sectionId, next, expectedVersion));
      if (result !== undefined) onReload();
    } finally {
      setSaving(false);
    }
  }

  function setType(type: ChartConfig["type"]) {
    if (!config) {
      void persist({ type, dataBinding: "INDICATOR_COMPARISON" });
      return;
    }
    void persist({ ...config, type });
  }

  function setBinding(dataBinding: ChartConfig["dataBinding"]) {
    void persist({ ...(config ?? { type: "BAR" }), dataBinding });
  }

  function removeChart() {
    if (readOnly) return;
    void actionState.run(() => updateReportSectionChartAction(sectionId, null, expectedVersion)).then((r) => {
      if (r !== undefined) {
        setConfig(null);
        onReload();
      }
    });
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Visualise this section with a chart</p>
        <div className="flex flex-wrap gap-2">
          {CHART_TYPES.map(([type, label]) => (
            <Button key={type} size="sm" variant="secondary" disabled={readOnly || saving} onClick={() => setType(type)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Chart type">
            {CHART_TYPES.map(([type, label]) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={config.type === type}
                onClick={() => setType(type)}
                disabled={readOnly || saving}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  config.type === type
                    ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Data" htmlFor={`binding-${sectionId}`}>
            <Select id={`binding-${sectionId}`} value={config.dataBinding} disabled={readOnly || saving} onChange={(e) => setBinding(e.target.value as ChartConfig["dataBinding"])}>
              {BINDINGS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          {actionState.error && <span role="alert" className="text-xs font-medium text-danger-700 dark:text-danger-400">{actionState.error}</span>}
          {!readOnly && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={removeChart}>
              Remove chart
            </Button>
          )}
        </div>
      </div>
      <div ref={chartRef} className="h-72 w-full" aria-label="Report chart" />
    </div>
  );
}
