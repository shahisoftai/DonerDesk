"use client";

import { useMemo, useState } from "react";
import { buildDataChart, DATA_CHART_TEMPLATES, DATA_CHART_TEMPLATE_ORDER, type DataChartSpec, type DataChartTemplate } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { PIVOT_MEASURE_LABEL, type PivotMeasure } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import type { ChartType } from "@donordesk/domain/contexts/reporting/chart-config.js";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { EChartFigure } from "@/features/reporting/presentation/ChartFigure";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const TYPE_LABEL: Record<ChartType, string> = { BAR: "Bar", LINE: "Line", PIE: "Pie", AREA: "Area", RADAR: "Radar", GAUGE: "Gauge" };

/** Quick starts for the combinations people ask for most; each only fills the form. */
const PRESETS: Array<{ label: string; spec: Partial<DataChartSpec> & { template: DataChartTemplate } }> = [
  { label: "Monthly achievement of an indicator", spec: { template: "INDICATOR_OVER_TIME", measure: "PERIOD", type: "BAR" } },
  { label: "Cumulative vs target", spec: { template: "INDICATOR_OVER_TIME", measure: "CUMULATIVE", type: "LINE", showTarget: true } },
  { label: "Achievement vs target", spec: { template: "INDICATOR_VS_TARGET", type: "BAR" } },
  { label: "Progress of all indicators", spec: { template: "INDICATORS_PROGRESS", type: "BAR" } },
  { label: "Budget vs expenditure", spec: { template: "FINANCE_BUDGET_VS_SPEND", type: "BAR" } },
];

export function DataChartBuilder({ sheet }: { sheet: DataSheetResponse }) {
  const [spec, setSpec] = useState<DataChartSpec>({ template: "INDICATOR_OVER_TIME", indicatorIds: sheet.indicators[0] ? [sheet.indicators[0].id] : [], measure: "PERIOD", type: "BAR", showTarget: false });
  const [filter, setFilter] = useState("");
  const info = DATA_CHART_TEMPLATES[spec.template];
  const templates = DATA_CHART_TEMPLATE_ORDER.filter((t) => sheet.financeEnabled || !t.startsWith("FINANCE_"));

  const result = useMemo(() => buildDataChart(sheet, spec), [sheet, spec]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sheet.indicators.filter((i) => !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [sheet.indicators, filter]);

  function update(patch: Partial<DataChartSpec>): void {
    setSpec((s) => ({ ...s, ...patch }));
  }

  function applyTemplate(template: DataChartTemplate, patch: Partial<DataChartSpec> = {}): void {
    const next = DATA_CHART_TEMPLATES[template];
    setSpec((s) => ({
      ...s,
      template,
      type: next.types.includes(s.type) ? s.type : next.types[0]!,
      // A single-indicator template keeps only the first chosen indicator.
      indicatorIds: next.indicators === "one" ? s.indicatorIds.slice(0, 1).concat(s.indicatorIds.length === 0 && sheet.indicators[0] ? [sheet.indicators[0].id] : []) : next.indicators === "many" && s.indicatorIds.length === 0 ? sheet.indicators.slice(0, 6).map((i) => i.id) : s.indicatorIds,
      showTarget: false,
      ...patch,
    }));
  }

  function toggle(id: string): void {
    setSpec((s) => {
      if (info.indicators === "one") return { ...s, indicatorIds: [id] };
      return { ...s, indicatorIds: s.indicatorIds.includes(id) ? s.indicatorIds.filter((x) => x !== id) : [...s.indicatorIds, id] };
    });
  }

  if (sheet.periods.length === 0) return <p className="card text-sm text-slate-500">Create a reporting period and record values to chart them here.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Quick start</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.filter((p) => sheet.financeEnabled || !p.spec.template.startsWith("FINANCE_")).map((p) => (
              <button key={p.label} type="button" className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:border-brand-400 hover:text-brand-700 dark:border-white/15" onClick={() => applyTemplate(p.spec.template, { measure: p.spec.measure ?? "PERIOD", showTarget: p.spec.showTarget ?? false, ...(p.spec.type ? { type: p.spec.type } : {}) })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-slate-500">
          Chart
          <Select className="mt-1" value={spec.template} onChange={(e) => applyTemplate(e.target.value as DataChartTemplate)}>
            {templates.map((t) => <option key={t} value={t}>{DATA_CHART_TEMPLATES[t].label}</option>)}
          </Select>
          <span className="mt-1 block">{info.description}</span>
        </label>

        {info.indicators !== "none" && (
          <fieldset>
            <legend className="text-xs text-slate-500">{info.indicators === "one" ? "Indicator" : `Indicators (${spec.indicatorIds.length} chosen)`}</legend>
            <Input className="mt-1" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find an indicator" aria-label="Find an indicator" />
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
              {shown.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type={info.indicators === "one" ? "radio" : "checkbox"} name="chart-indicator" checked={spec.indicatorIds.includes(i.id)} onChange={() => toggle(i.id)} className="mt-1" />
                  <span><span className="font-mono text-xs text-slate-500">{i.code}</span> {i.name}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="text-xs text-slate-500">No indicator matches.</p>}
            </div>
            {info.indicators === "many" && (
              <div className="mt-1 flex gap-3 text-xs">
                <button type="button" className="text-brand-600 hover:underline" onClick={() => update({ indicatorIds: shown.map((i) => i.id) })}>Choose all shown</button>
                <button type="button" className="text-brand-600 hover:underline" onClick={() => update({ indicatorIds: [] })}>Clear</button>
              </div>
            )}
          </fieldset>
        )}

        {info.usesMeasure && (
          <label className="block text-xs text-slate-500">
            Measure
            <Select className="mt-1" value={spec.measure} onChange={(e) => update({ measure: e.target.value as PivotMeasure })}>
              {(Object.keys(PIVOT_MEASURE_LABEL) as PivotMeasure[]).map((m) => <option key={m} value={m}>{PIVOT_MEASURE_LABEL[m]}</option>)}
            </Select>
          </label>
        )}

        {(spec.template === "INDICATOR_VS_TARGET" || spec.template === "INDICATORS_PROGRESS") && (
          <p className="text-xs text-slate-500">Uses the latest recorded value in the period range below.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            From
            <Select className="mt-1" value={spec.fromPeriodId ?? ""} onChange={(e) => update({ fromPeriodId: e.target.value || undefined })}>
              <option value="">First period</option>
              {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            To
            <Select className="mt-1" value={spec.toPeriodId ?? ""} onChange={(e) => update({ toPeriodId: e.target.value || undefined })}>
              <option value="">Last period</option>
              {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </label>
        </div>

        <div>
          <p className="text-xs text-slate-500">Chart type</p>
          <div className="mt-1 flex flex-wrap gap-1" role="tablist" aria-label="Chart type">
            {info.types.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={spec.type === t} onClick={() => update({ type: t })} className={`rounded-md px-3 py-1.5 text-sm font-medium ${spec.type === t ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {spec.template === "INDICATOR_OVER_TIME" && spec.measure === "CUMULATIVE" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={spec.showTarget} onChange={(e) => update({ showTarget: e.target.checked })} /> Show the target line
          </label>
        )}

        <label className="block text-xs text-slate-500">
          Title (optional)
          <Input className="mt-1" value={spec.title ?? ""} onChange={(e) => update({ title: e.target.value || undefined })} placeholder="Leave empty for an automatic title" />
        </label>
      </div>

      <div>
        {result.ok ? (
          <>
            <h3 className="font-medium">{result.title}</h3>
            <EChartFigure option={result.option} caption={`Drawn from the recorded values in the data sheet.`} />
            {result.notes.map((n) => <p key={n} className="mt-1 text-xs text-amber-700 dark:text-amber-300">{n}</p>)}
            <p className="mt-3 text-xs text-slate-500">To use a chart in a report, add a table with these figures to the section: charts in reports are drawn from the section’s tables and indicator data.</p>
          </>
        ) : (
          <div className="card text-sm text-slate-600 dark:text-slate-300" role="status">{result.reason}</div>
        )}
      </div>
    </div>
  );
}
