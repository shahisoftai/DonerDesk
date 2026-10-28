"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildChart, datasetQueryFor } from "@donordesk/domain/contexts/reporting/chart-render.js";
import { breakdownPie } from "@donordesk/domain/contexts/reporting/breakdown-chart.js";
import type { DatasetResult } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import { resolveChartDatasetAction } from "@/lib/actions/charts";
import { StudioChart, type ChartExport } from "@/features/charts/presentation/StudioChart";
import { INDICATOR_VIEWS, indicatorViewSpec, type IndicatorView } from "../domain/indicator-views";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** One indicator, four ways: against its target, over time, by place, and as a table. Each is read from the project's own figures. */
export function IndicatorViews({ projectId, indicatorId }: { projectId: string; indicatorId: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<IndicatorView>("TARGET");
  const [dataset, setDataset] = useState<DatasetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportRef = useRef<ChartExport | null>(null);
  // The group view is a pie of the recorded split, drawn by `breakdownPie` from the same dataset as the over-time view.
  const spec = useMemo(() => indicatorViewSpec(view === "BY_GROUP" ? "OVER_TIME" : view, indicatorId), [view, indicatorId]);

  useEffect(() => {
    if (!spec) return;
    let live = true;
    setDataset(null); setError(null);
    void resolveChartDatasetAction(projectId, datasetQueryFor(spec, [indicatorId])).then((r) => {
      if (!live) return;
      if (!r.ok) setError(r.error.message);
      else if ("unavailable" in r.value) setError(r.value.unavailable);
      else setDataset(r.value.dataset as unknown as DatasetResult);
    });
    return () => { live = false; };
  }, [spec, projectId, indicatorId]);

  const built = useMemo(() => {
    if (!spec || !dataset) return null;
    if (view !== "BY_GROUP") return buildChart(spec, dataset);
    const pie = breakdownPie(dataset, indicatorId);
    return pie.ok ? ({ ok: true, render: "ECHART", option: pie.option, title: pie.title, notes: pie.notes, alt: pie.alt, aspect: 1.6 } as const) : pie;
  }, [spec, dataset, view, indicatorId]);

  return (
    <section className="card mt-4" aria-label={t("indicatorViews.title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t("indicatorViews.title")}</h3>
        <Link className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/charts`}>{t("indicatorViews.studio")}</Link>
      </div>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2">
        {INDICATOR_VIEWS.map((v) => (
          <button key={v} role="tab" type="button" aria-selected={v === view} onClick={() => setView(v)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${v === view ? "border-brand-500 bg-brand-50 font-medium dark:bg-white/10" : "border-slate-300 dark:border-white/15"}`}>{t(`indicatorViews.${v}`)}</button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {!spec ? <p className="text-sm text-slate-500">{t("indicatorViews.none")}</p>
          : error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
          : !built ? <p role="status" className="text-sm text-slate-500">{t("tile.loading")}</p>
          : !built.ok ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{built.reason}</p>
          : built.render === "TABLE" ? (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{built.columns.map((c) => <th key={c} className="px-2 py-1 text-start font-medium">{c}</th>)}</tr></thead><tbody>{built.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-2 py-1">{cell ?? t("indicatorViews.notMeasured")}</td>)}</tr>)}</tbody></table></div>
          ) : <StudioChart key={`${view}|${"maps" in built ? built.maps?.join(",") ?? "" : ""}`} option={built.option} aspect={built.aspect} label={built.alt} exportRef={exportRef} maps={"maps" in built ? built.maps : undefined} regionNames={"regionNames" in built ? built.regionNames : undefined} />}
        {built?.ok && built.notes.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-500">{built.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </div>
    </section>
  );
}
