"use client";

import { useEffect, useRef, useState } from "react";
import type * as echarts from "echarts";
import { allowedChartTypes, bindingsForSection, buildChartOption, coerceChartType, resolveChartData, type ChartConfig, type ChartDataBinding, type ChartType } from "@donordesk/domain/contexts/reporting/chart-config.js";
import { refreshSectionChartsAction, updateReportSectionChartAction } from "@/lib/actions/reporting";
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

const BINDING_LABELS: Record<ChartDataBinding, string> = {
  INDICATOR_PROGRESS: "Progress against target (% of target)",
  INDICATOR_COMPARISON: "Baseline vs target vs achievement",
  INDICATOR_ACHIEVEMENT: "Achievement vs target",
  STATUS_DISTRIBUTION: "Verification status",
};

export function ReportChartPanel({
  sectionId,
  sectionTitle,
  initialConfig,
  expectedVersion,
  indicators,
  readOnly,
  onReload,
}: {
  sectionId: string;
  /** What the section is about decides which indicator charts make sense for it. */
  sectionTitle: string;
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

  // Lazy-load ECharts once a chart exists. The chart container only renders
  // when there is a config, so initialise on the first config (e.g. right
  // after "Add chart"), not only on mount, and dispose on removal/unmount.
  const hasConfig = config !== null;
  useEffect(() => {
    if (!hasConfig) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("echarts").then((mod) => {
      if (disposed || !chartRef.current) return;
      const instance = mod.init(chartRef.current);
      chartInstance.current = instance;
      if (config) instance.setOption(buildChartOption(indicators, config));
      const onResize = () => instance.resize();
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        instance.dispose();
        chartInstance.current = null;
      };
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConfig]);

  // Re-render whenever config or data changes.
  useEffect(() => {
    if (chartInstance.current && config) {
      chartInstance.current.setOption(buildChartOption(indicators, config), true);
    }
  }, [config, indicators]);

  const bindings = bindingsForSection(sectionTitle);
  const categoryCount = config ? resolveChartData(indicators, config).categories.length : indicators.length;
  const typesFor = (binding: ChartDataBinding): ChartType[] => allowedChartTypes(binding, categoryCount);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  async function rebuildFromTables() {
    if (readOnly || saving) return;
    setSaving(true);
    try {
      const r = await actionState.run(() => refreshSectionChartsAction(sectionId));
      if (r !== undefined) {
        setRefreshNote(r.charts === 0 ? "No table in this section has a chart to draw." : `${r.charts} chart${r.charts === 1 ? "" : "s"} rebuilt from the tables.`);
        onReload();
      }
    } finally {
      setSaving(false);
    }
  }

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
    const dataBinding = config?.dataBinding ?? bindings[0];
    if (!dataBinding) return;
    void persist({ type: coerceChartType(dataBinding, type, categoryCount), dataBinding, options: config?.options ?? {} });
  }

  function setBinding(dataBinding: ChartConfig["dataBinding"]) {
    void persist({ type: coerceChartType(dataBinding, config?.type ?? "BAR", categoryCount), dataBinding, options: config?.options ?? {} });
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

  const tablesNote = (
    <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
      <p>Charts for the tables in this section (indicators, finance, participants) are drawn automatically beside each table and follow it when you edit it.</p>
      {!readOnly && (
        <Button size="sm" variant="secondary" className="mt-2" disabled={saving} onClick={() => void rebuildFromTables()}>
          Rebuild charts from tables
        </Button>
      )}
      {refreshNote && <p role="status" className="mt-1.5 text-slate-500 dark:text-slate-400">{refreshNote}</p>}
      {actionState.error && <p role="alert" className="mt-1.5 font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>}
    </div>
  );

  if (bindings.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">This section has no indicator data to chart by hand.</p>
        {tablesNote}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Add an indicator chart to this section</p>
        <div className="flex flex-wrap gap-2">
          {typesFor(bindings[0]!).map((type) => (
            <Button key={type} size="sm" variant="secondary" disabled={readOnly || saving} onClick={() => setType(type)}>
              {CHART_TYPES.find(([t]) => t === type)?.[1]}
            </Button>
          ))}
        </div>
        {tablesNote}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Chart type">
            {CHART_TYPES.filter(([type]) => typesFor(config.dataBinding).includes(type)).map(([type, label]) => (
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
              {bindings.map((value) => (
                <option key={value} value={value}>{BINDING_LABELS[value]}</option>
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
      {tablesNote}
    </div>
  );
}
