"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildChart, datasetQueryFor, type ChartBuild } from "@donordesk/domain/contexts/reporting/chart-render.js";
import { CHART_KINDS, CHART_SIZES, LABEL_FORMATS, LEGEND_POSITIONS, NUMBER_FORMATS, TEMPLATE_SHAPE, kindsByFamily, validateChartSpec, type ChartKind, type ChartSpecV2, type SeriesStyle } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { CHART_PALETTES, DATA_CHART_TEMPLATES, type DataChartTemplate } from "@donordesk/domain/contexts/reporting/data-charts.js";
import type { DatasetResult } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { deleteChartAction, getSavedChartAction, listSavedChartsAction, resolveChartDatasetAction, saveChartAction } from "@/lib/actions/charts";
import { addDashboardChartAction, listDashboardsAction } from "@/lib/actions/dashboards";
import type { SavedChartDetail, SavedChartView } from "@/lib/server/schemas-charts";
import type { DashboardSummary } from "@/lib/server/schemas-dashboards";
import { cn } from "@/components/ui/cn";
import { StudioChart, type ChartExport } from "./StudioChart";
import { placesToGeoJson, placesToKml, splitPinned } from "@donordesk/domain/contexts/reporting/places-export.js";
import {
  MAP_FAMILIES, STUDIO_TEMPLATES, addAnnotation, initialMapSpec, applyEdit, dataTable, fileNameFor, initialSpec, kindChoices, redo, removeAnnotation, startStudio, suggestedFix, toCsv, toggleIndicator,
  undo, updateAnnotation, withAxis, withKind, withSeriesStyle, withTemplate, withText, type StudioState,
} from "../domain/studio-state";

export interface StudioIndicator { id: string; code: string; name: string; unit?: string | undefined; isRate: boolean }
export interface StudioPeriod { id: string; label: string }

const PALETTE_DEFAULT = "STANDARD";

const download = (name: string, href: string) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs"><span className="mb-0.5 block font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}</label>
);
const Section = ({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) => (
  <details open={open} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/60"><summary className="cursor-pointer text-sm font-semibold">{title}</summary><div className="mt-2 space-y-2">{children}</div></details>
);

/**
 * The Chart Studio: data on the left, the drawing in the middle, type and style on the right. Everything it does is in `studio-state.ts`
 * (edits that keep a spec valid, undo and redo) and the domain's `buildChart` (the honest drawing); this only draws the controls.
 */
export function ChartStudio({ projectId, indicators, periods, initialCharts, canShare, mode = "chart" }: { projectId: string; indicators: StudioIndicator[]; periods: StudioPeriod[]; initialCharts: SavedChartView[]; canShare: boolean; /** "map": the Maps screen (places, maps and rankings by place; KML and GeoJSON downloads). */ mode?: "chart" | "map" }) {
  const { t } = useI18n();
  const allIds = useMemo(() => indicators.map((i) => i.id), [indicators]);
  const startSpec = useCallback(() => (mode === "map" ? initialMapSpec(allIds) : initialSpec(allIds)), [mode, allIds]);
  const [studio, setStudio] = useState<StudioState>(() => startStudio(startSpec()));
  const spec = studio.spec;
  const edit = useCallback((next: ChartSpecV2 | null) => { if (next) setStudio((s) => applyEdit(s, next)); }, []);

  const [dataset, setDataset] = useState<DatasetResult | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [search, setSearch] = useState("");
  const isMapView = (c: SavedChartView): boolean => mode !== "map" || (c.spec as { dataset?: { template?: string } }).dataset?.template === "RESULTS_BY_PLACE";
  const [charts, setCharts] = useState<SavedChartView[]>(initialCharts.filter(isMapView));
  const [current, setCurrent] = useState<{ id: string; updatedAt: string } | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"MINE" | "PROJECT">("MINE");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const exportRef = useRef<ChartExport | null>(null);
  const [missingRegions, setMissingRegions] = useState<string[]>([]);
  const [versions, setVersions] = useState<SavedChartDetail["versions"]>([]);
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [dashboardId, setDashboardId] = useState("");
  useEffect(() => {
    void listDashboardsAction(projectId).then((r) => { if (r.ok) setDashboards(r.value.filter((d) => d.canEdit)); });
  }, [projectId]);

  // The dataset: asked for again, after a short pause, whenever what the chart is drawn from changes. Styling never asks again.
  const query = useMemo(() => datasetQueryFor(spec, allIds), [spec, allIds]);
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    if (indicators.length === 0) return;
    let live = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void resolveChartDatasetAction(projectId, query).then((r) => {
        if (!live) return;
        setLoading(false);
        if (!r.ok) { setDataError(r.error.message); setDataset(null); return; }
        if ("unavailable" in r.value) { setDataError(r.value.unavailable); setDataset(null); return; }
        setDataError(null);
        setDataset(r.value.dataset as unknown as DatasetResult);
      });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, projectId]);

  const built: ChartBuild | null = useMemo(() => (dataset ? buildChart(spec, dataset) : null), [spec, dataset]);
  const problems = useMemo(() => validateChartSpec(spec), [spec]);
  const table = useMemo(() => (dataset ? dataTable(dataset) : null), [dataset]);
  const refused = built && !built.ok ? built.reason : problems[0]?.message ?? null;
  const fix = refused ? suggestedFix(refused) : null;

  const seriesNames: string[] = useMemo(() => {
    const shape = DATA_CHART_TEMPLATES[spec.dataset.template];
    return shape.indicators === "many" || shape.indicators === "one"
      ? (spec.dataset.template === "INDICATORS_OVER_TIME" || spec.dataset.template === "INDICATOR_OVER_TIME" ? (dataset?.indicators.map((i) => i.code) ?? spec.dataset.indicatorIds) : [shape.label])
      : [shape.label];
  }, [spec.dataset, dataset]);

  const visibleIndicators = indicators.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const choices = kindChoices(spec);
  const families = kindsByFamily().filter((f) => mode !== "map" || MAP_FAMILIES.has(f.family));
  const style = (index: number): SeriesStyle | undefined => spec.series?.find((s) => s.index === index);
  const dirty = !current;

  async function save(asNew: boolean) {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const body = { name: name.trim() || (built?.ok ? built.title : "Chart"), scope: canShare ? scope : "MINE", projectId, spec, ...(!asNew && current ? { expectedUpdatedAt: current.updatedAt } : {}) };
    const result = await saveChartAction(body, asNew ? undefined : current?.id);
    setSaving(false);
    if (!result.ok) { setMessage({ tone: "error", text: result.error.message }); return; }
    setCurrent({ id: result.value.id, updatedAt: result.value.updatedAt });
    setName(body.name);
    setMessage({ tone: "ok", text: t("studio.saved", { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }) });
    const list = await listSavedChartsAction(projectId);
    if (list.ok) setCharts(list.value.filter(isMapView));
    const detail = await getSavedChartAction(result.value.id);
    if (detail.ok) setVersions(detail.value.versions);
  }
  async function open(c: SavedChartView) {
    setStudio(startStudio(c.spec as unknown as ChartSpecV2));
    setCurrent({ id: c.id, updatedAt: c.updatedAt });
    setName(c.name);
    setScope(c.scope);
    setMessage(null);
    setVersions([]);
    const detail = await getSavedChartAction(c.id);
    if (detail.ok) setVersions(detail.value.versions);
  }
  function fresh() { setStudio(startStudio(startSpec())); setCurrent(null); setName(""); setMessage(null); setVersions([]); }
  function restore(v: SavedChartDetail["versions"][number]) {
    edit(v.spec as unknown as ChartSpecV2);
    setName(v.name);
    setMessage({ tone: "ok", text: t("studio.versions.restored") });
  }
  async function addToDashboard() {
    if (!dashboardId) return;
    const r = await addDashboardChartAction(dashboardId, { projectId, spec });
    setMessage(r.ok ? { tone: "ok", text: t("studio.dashboard.added") } : { tone: "error", text: r.error.message });
  }
  async function remove(c: SavedChartView) {
    if (!window.confirm(t("studio.deleteConfirm", { name: c.name }))) return;
    const r = await deleteChartAction(c.id);
    if (!r.ok) { setMessage({ tone: "error", text: r.error.message }); return; }
    if (current?.id === c.id) fresh();
    const list = await listSavedChartsAction(projectId);
    if (list.ok) setCharts(list.value.filter(isMapView));
  }
  const title = built?.ok ? built.title : spec.title ?? "chart";
  const exportPng = () => { const url = exportRef.current?.png(); if (url) download(fileNameFor(title, "png"), url); };
  const exportSvg = () => { const svg = exportRef.current?.svg(); if (svg) download(fileNameFor(title, "svg"), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); };
  const placeFile = (kind: "kml" | "geojson") => {
    if (!dataset?.places) return;
    const ind = dataset.indicators[0];
    const o = { title, valueLabel: ind ? `${ind.code} ${ind.name}` : "Value", unit: ind?.unit };
    const text = kind === "kml" ? placesToKml(dataset.places, o) : placesToGeoJson(dataset.places, o);
    download(fileNameFor(title, kind === "kml" ? "kml" : "geojson"), `data:${kind === "kml" ? "application/vnd.google-earth.kml+xml" : "application/geo+json"};charset=utf-8,${encodeURIComponent(text)}`);
  };
  const unpinned = useMemo(() => (dataset?.places ? splitPinned(dataset.places).unpinned : []), [dataset]);
  const exportCsv = () => { if (table) download(fileNameFor(title, "csv"), `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${toCsv(table)}`)}`); };

  const num = (text: string): number | undefined => (text.trim() === "" ? undefined : Number(text));
  const btn = "btn-secondary px-2 py-1 text-xs";
  const input = "input px-2 py-1 text-xs";

  if (indicators.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("studio.noIndicators")}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{t(mode === "map" ? "map.title" : "studio.title")}</h2>
        <button type="button" className={btn} onClick={() => setStudio((s) => undo(s))} disabled={studio.past.length === 0}>{t("studio.undo")}</button>
        <button type="button" className={btn} onClick={() => setStudio((s) => redo(s))} disabled={studio.future.length === 0}>{t("studio.redo")}</button>
        <button type="button" className={btn} onClick={fresh}>{t("studio.new")}</button>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <input aria-label={t("studio.name")} placeholder={t("studio.name")} value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "w-44")} />
          {canShare && (
            <select aria-label={t("studio.scope")} value={scope} onChange={(e) => setScope(e.target.value === "PROJECT" ? "PROJECT" : "MINE")} disabled={Boolean(current)} className={cn(input, "w-auto")}>
              <option value="MINE">{t("studio.scope.MINE")}</option><option value="PROJECT">{t("studio.scope.PROJECT")}</option>
            </select>
          )}
          <button type="button" className="btn px-3 py-1 text-xs" onClick={() => void save(false)} disabled={saving || problems.length > 0}>{t("studio.save")}</button>
          {current && <button type="button" className={btn} onClick={() => void save(true)} disabled={saving || problems.length > 0}>{t("studio.saveAs")}</button>}
          <span data-testid="studio-status" role="status" className={cn("text-xs", message?.tone === "error" ? "text-red-700 dark:text-red-300" : "text-slate-500 dark:text-slate-400")}>{message?.text ?? (dirty ? t("studio.unsaved") : "")}</span>
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        {/* ---------- data ---------- */}
        <div className="space-y-2">
          <Section title={t("studio.data")} open>
            <Field label={t("studio.template")}>
              <select aria-label={t("studio.template")} className={cn(input, "w-full")} value={spec.dataset.template} onChange={(e) => edit(withTemplate(spec, e.target.value as DataChartTemplate, allIds))}>
                {STUDIO_TEMPLATES.filter((tp) => mode !== "map" || tp === "RESULTS_BY_PLACE").map((tp) => <option key={tp} value={tp}>{DATA_CHART_TEMPLATES[tp].label}</option>)}
              </select>
            </Field>
            {DATA_CHART_TEMPLATES[spec.dataset.template].indicators !== "none" && (
              <fieldset>
                <legend className="mb-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">{t("studio.indicators")}</legend>
                <input type="search" aria-label={t("studio.indicators.search")} placeholder={t("studio.indicators.search")} value={search} onChange={(e) => setSearch(e.target.value)} className={cn(input, "mb-1 w-full")} />
                <ul className="max-h-48 space-y-0.5 overflow-auto text-xs">
                  {visibleIndicators.map((i) => (
                    <li key={i.id}>
                      <label className="flex items-start gap-1.5">
                        <input type={DATA_CHART_TEMPLATES[spec.dataset.template].indicators === "one" ? "radio" : "checkbox"} checked={spec.dataset.indicatorIds.includes(i.id)} onChange={() => edit(toggleIndicator(spec, i.id))} />
                        <span><span className="font-mono">{i.code}</span> {i.name}{i.unit ? <span className="text-slate-500"> · {i.unit}</span> : null}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            {!["FINANCE", "STATUS", "PLAN", "DAYS", "BUDGET", "PLACES"].includes(TEMPLATE_SHAPE[spec.dataset.template] ?? "") && <Field label={t("studio.measure")}>
              <select aria-label={t("studio.measure")} className={cn(input, "w-full")} value={spec.dataset.measure} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, measure: e.target.value as ChartSpecV2["dataset"]["measure"] } })}>
                {(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"] as const).map((m) => <option key={m} value={m}>{t(`studio.measure.${m}`)}</option>)}
              </select>
            </Field>}
            {TEMPLATE_SHAPE[spec.dataset.template] === "PLACES" && (
              <Field label={t("studio.placeLevel")}>
                <select aria-label={t("studio.placeLevel")} className={cn(input, "w-full")} value={spec.dataset.placeLevel ?? 1} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, placeLevel: Number(e.target.value) } })}>
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{t(`studio.placeLevel.${n}`)}</option>)}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("studio.periodStart")}>
                <select aria-label={t("studio.periodStart")} className={cn(input, "w-full")} value={spec.dataset.fromPeriodId ?? ""} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, fromPeriodId: e.target.value || undefined } })}>
                  <option value="">—</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label={t("studio.periodEnd")}>
                <select aria-label={t("studio.periodEnd")} className={cn(input, "w-full")} value={spec.dataset.toPeriodId ?? ""} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, toPeriodId: e.target.value || undefined } })}>
                  <option value="">—</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={spec.dataset.showTarget} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, showTarget: e.target.checked } })} />{t("studio.showTarget")}</label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={spec.dataset.includeDraft} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, includeDraft: e.target.checked } })} />{t("studio.includeDraft")}</label>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("studio.sort")}>
                <select aria-label={t("studio.sort")} className={cn(input, "w-full")} value={spec.dataset.sort ?? "NONE"} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, sort: e.target.value as "NONE" } })}>
                  {(["NONE", "ASC", "DESC", "LABEL"] as const).map((s) => <option key={s} value={s}>{t(`studio.sort.${s}`)}</option>)}
                </select>
              </Field>
              <Field label={t("studio.topN")}>
                <select aria-label={t("studio.topN")} className={cn(input, "w-full")} value={spec.dataset.topN ?? ""} onChange={(e) => edit({ ...spec, dataset: { ...spec.dataset, topN: e.target.value ? Number(e.target.value) : undefined } })}>
                  <option value="">{t("studio.topN.all")}</option>{[3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>
          </Section>
          <Section title={t("studio.library")} open={charts.length > 0}>
            {charts.length === 0 ? <p className="text-xs text-slate-500">{t("studio.library.empty")}</p> : (
              <ul className="space-y-1 text-xs">
                {charts.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <button type="button" className={cn("flex-1 truncate text-start underline", current?.id === c.id && "font-semibold")} onClick={() => void open(c)} title={t("studio.open")}>{c.name}</button>
                    <span className="text-slate-500">{t(`studio.scope.${c.scope}`)}</span>
                    {c.canEdit && <button type="button" className="text-red-700 dark:text-red-300" onClick={() => void remove(c)} aria-label={`${t("studio.delete")} ${c.name}`}>×</button>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {current && (
            <Section title={t("studio.versions")} open={versions.length > 0}>
              {versions.length === 0 ? <p className="text-xs text-slate-500">{t("studio.versions.none")}</p> : (
                <ul className="space-y-1 text-xs" data-testid="versions">
                  {versions.map((v) => (
                    <li key={v.at} className="flex items-center gap-1">
                      <span className="flex-1 truncate" title={v.name}>{v.name} · {t("studio.versions.at", { time: new Date(v.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) })}</span>
                      <button type="button" className="underline" onClick={() => restore(v)}>{t("studio.versions.restore")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          <Section title={t("studio.dashboard")}>
            {dashboards.length === 0 ? <p className="text-xs text-slate-500">{t("studio.dashboard.none")}</p> : (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label={t("studio.dashboard.choose")} className={cn(input, "w-auto max-w-full")} value={dashboardId} onChange={(e) => setDashboardId(e.target.value)}>
                  <option value="">{t("studio.dashboard.choose")}</option>{dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="button" className={btn} disabled={!dashboardId || problems.length > 0} onClick={() => void addToDashboard()}>{t("studio.dashboard.add")}</button>
              </div>
            )}
          </Section>
        </div>

        {/* ---------- canvas ---------- */}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className={cn(btn, view === "chart" && "border-brand-600")} aria-pressed={view === "chart"} onClick={() => setView("chart")}>{t("studio.view.chart")}</button>
            <button type="button" className={cn(btn, view === "table" && "border-brand-600")} aria-pressed={view === "table"} onClick={() => setView("table")}>{t("studio.view.table")}</button>
            <span className="ms-auto flex items-center gap-2">
              <span className="text-slate-500">{t("studio.export")}</span>
              <button type="button" className={btn} onClick={exportPng} disabled={!(built?.ok && built.render === "ECHART") || view !== "chart"}>{t("studio.export.png")}</button>
              <button type="button" className={btn} onClick={exportSvg} disabled={!(built?.ok && built.render === "ECHART") || view !== "chart"}>{t("studio.export.svg")}</button>
              <button type="button" className={btn} onClick={exportCsv} disabled={!table}>{t("studio.export.csv")}</button>
              {dataset?.places && <button type="button" className={btn} onClick={() => placeFile("kml")} disabled={splitPinned(dataset.places).pinned.length === 0}>{t("studio.export.kml")}</button>}
              {dataset?.places && <button type="button" className={btn} onClick={() => placeFile("geojson")} disabled={splitPinned(dataset.places).pinned.length === 0}>{t("studio.export.geojson")}</button>}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/60" aria-busy={loading}>
            {view === "table" ? (
              table ? (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-xs" data-testid="data-table"><thead><tr>{table.columns.map((c) => <th key={c} className="border-b px-2 py-1 text-start">{c}</th>)}</tr></thead>
                    <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-white/5">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
                </div>
              ) : <p className="text-sm">{loading ? t("studio.loading") : dataError}</p>
            ) : dataError ? <p className="text-sm text-red-700 dark:text-red-300">{dataError}</p>
              : !built ? <p className="text-sm text-slate-500">{t("studio.loading")}</p>
              : built.ok && built.render === "ECHART" ? <StudioChart key={`${spec.kind}|${built.maps?.join(",") ?? ""}`} option={built.option} aspect={built.aspect} label={built.alt} exportRef={exportRef} maps={built.maps} regionNames={built.regionNames} onMissingRegions={setMissingRegions} />
              : built.ok ? (
                <div className="overflow-auto" data-testid="chart-table">
                  <h3 className="mb-2 text-sm font-semibold">{built.title}</h3>
                  <table className="w-full text-xs"><thead><tr>{built.columns.map((c) => <th key={c} className="border-b px-2 py-1 text-start">{c}</th>)}</tr></thead>
                    <tbody>{built.rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-white/5">{r.map((c, j) => <td key={j} className={cn("px-2 py-1", c === "Not measured" && "text-slate-500")}>{c}</td>)}</tr>)}</tbody></table>
                </div>
              ) : (
                <div role="alert" data-testid="refused" className="space-y-2 text-sm">
                  <p className="font-medium">{t("studio.refused")}</p>
                  <p>{built.reason}</p>
                  {fix && <button type="button" className="btn px-3 py-1 text-xs" onClick={() => edit(fix.apply(spec))}>{fix.label}</button>}
                </div>
              )}
            {view === "chart" && built?.ok && (
              <div className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                {spec.caption && <p>{spec.caption}</p>}
                {built.notes.map((n) => <p key={n}>{n}</p>)}
                {unpinned.length > 0 && <p role="status" data-testid="unpinned">{t("studio.map.unpinned", { count: unpinned.length, names: unpinned.slice(0, 5).map((p) => p.name).join(", ") })}</p>}
                {missingRegions.length > 0 && built.render === "ECHART" && built.maps && <p role="status" data-testid="missing-regions" className="text-amber-700 dark:text-amber-300">{t("studio.regionsMissing", { names: missingRegions.join(", ") })}</p>}
              </div>
            )}
          </div>
          {refused && !(built && !built.ok) && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{refused}</p>}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("studio.dataNote")}</p>
        </div>

        {/* ---------- type and style ---------- */}
        <div className="space-y-2">
          <Section title={t("studio.type")} open>
            <div className="max-h-72 space-y-2 overflow-auto">
              {families.map(({ family, kinds }) => (
                <div key={family}>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t(`family.${family}`)}</p>
                  <div className="flex flex-wrap gap-1">
                    {kinds.map((k: ChartKind) => {
                      const c = choices.find((x) => x.kind === k)!;
                      const reason = c.state === "PLANNED" ? t("studio.kind.planned") : c.state === "NEEDS_OTHER_DATA" ? t("studio.kind.needsOtherData") : undefined;
                      return (
                        <button key={k} type="button" disabled={c.state !== "OK"} title={reason} aria-pressed={c.current} aria-label={t(`kind.${k}`)} data-kind={k}
                          onClick={() => edit(withKind(spec, k))}
                          className={cn("rounded border px-1.5 py-0.5 text-xs", c.current ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-white/15", c.state !== "OK" && "cursor-not-allowed opacity-40")}>
                          {t(`kind.${k}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title={t("studio.style")} open>
            <Field label={t("studio.chartTitle")}><input aria-label={t("studio.chartTitle")} className={cn(input, "w-full")} value={spec.title ?? ""} onChange={(e) => edit(withText(spec, "title", e.target.value))} /></Field>
            <Field label={t("studio.subtitle")}><input aria-label={t("studio.subtitle")} className={cn(input, "w-full")} value={spec.subtitle ?? ""} onChange={(e) => edit(withText(spec, "subtitle", e.target.value))} /></Field>
            <Field label={t("studio.caption")}><input aria-label={t("studio.caption")} className={cn(input, "w-full")} value={spec.caption ?? ""} onChange={(e) => edit(withText(spec, "caption", e.target.value))} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("studio.size")}>
                <select aria-label={t("studio.size")} className={cn(input, "w-full")} value={spec.size ?? "WIDE"} onChange={(e) => edit({ ...spec, size: e.target.value as ChartSpecV2["size"] })}>
                  {CHART_SIZES.map((s) => <option key={s} value={s}>{t(`studio.size.${s}`)}</option>)}
                </select>
              </Field>
              <Field label={t("studio.palette")}>
                <select aria-label={t("studio.palette")} className={cn(input, "w-full")} value={spec.paletteId ?? PALETTE_DEFAULT} onChange={(e) => edit({ ...spec, paletteId: e.target.value })}>
                  {CHART_PALETTES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label={t("studio.legend")}>
                <select aria-label={t("studio.legend")} className={cn(input, "w-full")} value={spec.legend?.position ?? "BOTTOM"} onChange={(e) => edit({ ...spec, legend: { position: e.target.value as "TOP" } })}>
                  {LEGEND_POSITIONS.map((p) => <option key={p} value={p}>{t(`studio.legend.${p}`)}</option>)}
                </select>
              </Field>
              <Field label={t("studio.numberFormat")}>
                <select aria-label={t("studio.numberFormat")} className={cn(input, "w-full")} value={spec.labels?.numberFormat ?? "FULL"} onChange={(e) => edit({ ...spec, labels: { show: spec.labels?.show ?? false, format: spec.labels?.format ?? "VALUE", numberFormat: e.target.value as "FULL" } })}>
                  {NUMBER_FORMATS.map((f) => <option key={f} value={f}>{t(`studio.numberFormat.${f}`)}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={spec.labels?.show ?? false} onChange={(e) => edit({ ...spec, labels: { show: e.target.checked, format: spec.labels?.format ?? "VALUE", numberFormat: spec.labels?.numberFormat } })} />{t("studio.labels.show")}</label>
            {spec.labels?.show && (
              <Field label={t("studio.labels.format")}>
                <select aria-label={t("studio.labels.format")} className={cn(input, "w-full")} value={spec.labels.format} onChange={(e) => edit({ ...spec, labels: { ...spec.labels!, format: e.target.value as "VALUE" } })}>
                  {LABEL_FORMATS.map((f) => <option key={f} value={f}>{t(`studio.labels.${f}`)}</option>)}
                </select>
              </Field>
            )}
            <Field label={t("studio.altText")}><textarea aria-label={t("studio.altText")} rows={2} className={cn(input, "w-full")} value={spec.altText ?? ""} onChange={(e) => edit(withText(spec, "altText", e.target.value))} /><span className="text-[11px] text-slate-500">{t("studio.altText.hint")}</span></Field>
          </Section>
          <Section title={t("studio.axes")}>
            {(["y", "x", "y2"] as const).map((axis) => (
              <fieldset key={axis} className="space-y-1">
                <legend className="text-xs font-semibold">{t(`studio.axis.${axis}`)}</legend>
                <input aria-label={`${t(`studio.axis.${axis}`)} ${t("studio.axis.title")}`} placeholder={t("studio.axis.title")} className={cn(input, "w-full")} value={spec.axes?.[axis]?.title ?? ""} onChange={(e) => edit(withAxis(spec, axis, { title: e.target.value }))} />
                {axis !== "x" && (
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" aria-label={`${t(`studio.axis.${axis}`)} ${t("studio.axis.min")}`} placeholder={t("studio.axis.min")} className={input} value={spec.axes?.[axis]?.min ?? ""} onChange={(e) => edit(withAxis(spec, axis, { min: num(e.target.value) }))} />
                    <input type="number" aria-label={`${t(`studio.axis.${axis}`)} ${t("studio.axis.max")}`} placeholder={t("studio.axis.max")} className={input} value={spec.axes?.[axis]?.max ?? ""} onChange={(e) => edit(withAxis(spec, axis, { max: num(e.target.value) }))} />
                  </div>
                )}
                {axis === "y" && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={spec.axes?.y?.scale === "LOG"} onChange={(e) => edit(withAxis(spec, "y", { scale: e.target.checked ? "LOG" : undefined }))} />{t("studio.axis.log")}</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={spec.axes?.y?.reversed === true} onChange={(e) => edit(withAxis(spec, "y", { reversed: e.target.checked ? true : undefined }))} />{t("studio.axis.reversed")}</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={spec.axes?.y?.gridlines !== false} onChange={(e) => edit(withAxis(spec, "y", { gridlines: e.target.checked ? undefined : false }))} />{t("studio.axis.grid")}</label>
                  </div>
                )}
              </fieldset>
            ))}
          </Section>
          <Section title={t("studio.series")}>
            {seriesNames.map((n, i) => (
              <fieldset key={`${n}-${i}`} className="space-y-1 rounded border border-slate-100 p-1.5 dark:border-white/5">
                <legend className="px-1 text-xs font-semibold">{n}</legend>
                <input aria-label={`${n} ${t("studio.series.name")}`} placeholder={t("studio.series.name")} className={cn(input, "w-full")} value={style(i)?.label ?? ""} onChange={(e) => edit(withSeriesStyle(spec, i, { label: e.target.value || undefined }))} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">{t("studio.series.colour")}<input type="color" aria-label={`${n} ${t("studio.series.colour")}`} value={style(i)?.color ?? "#2f7be8"} onChange={(e) => edit(withSeriesStyle(spec, i, { color: e.target.value }))} /></label>
                  {spec.dataset.template === "INDICATORS_OVER_TIME" && (
                    <>
                      <select aria-label={`${n} ${t("studio.series.type")}`} className={cn(input, "w-auto")} value={style(i)?.kind ?? ""} onChange={(e) => edit(withSeriesStyle(spec, i, { kind: (e.target.value || undefined) as ChartKind | undefined }))}>
                        <option value="">{t("studio.series.type")}</option><option value="BAR">{t("kind.BAR")}</option><option value="LINE">{t("kind.LINE")}</option><option value="AREA">{t("kind.AREA")}</option>
                      </select>
                      <select aria-label={`${n} ${t("studio.series.axis")}`} className={cn(input, "w-auto")} value={style(i)?.axis ?? "PRIMARY"} onChange={(e) => edit(withSeriesStyle(spec, i, { axis: e.target.value === "SECONDARY" ? "SECONDARY" : undefined }))}>
                        <option value="PRIMARY">{t("studio.series.axis.PRIMARY")}</option><option value="SECONDARY">{t("studio.series.axis.SECONDARY")}</option>
                      </select>
                    </>
                  )}
                  <label className="flex items-center gap-1"><input type="checkbox" checked={style(i)?.hidden === true} onChange={(e) => edit(withSeriesStyle(spec, i, { hidden: e.target.checked }))} />{t("studio.series.hide")}</label>
                </div>
              </fieldset>
            ))}
          </Section>
          <Section title={t("studio.annotations")}>
            {(spec.annotations ?? []).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-1 text-xs">
                <span className="font-medium">{a.type === "LINE" ? t("studio.annotation.line") : a.type === "BAND" ? t("studio.annotation.band") : t("studio.annotation.note")}</span>
                {a.type === "LINE" && <input type="number" aria-label={t("studio.annotation.value")} className={cn(input, "w-20")} value={a.value} onChange={(e) => edit(updateAnnotation(spec, a.id, { value: Number(e.target.value) }))} />}
                {a.type === "BAND" && (
                  <>
                    <input type="number" aria-label={t("studio.annotation.from")} className={cn(input, "w-16")} value={a.from} onChange={(e) => edit(updateAnnotation(spec, a.id, { from: Number(e.target.value) }))} />
                    <input type="number" aria-label={t("studio.annotation.to")} className={cn(input, "w-16")} value={a.to} onChange={(e) => edit(updateAnnotation(spec, a.id, { to: Number(e.target.value) }))} />
                  </>
                )}
                <input aria-label={t("studio.annotation.text")} placeholder={t("studio.annotation.text")} className={cn(input, "min-w-0 flex-1")} value={a.text ?? ""} onChange={(e) => edit(updateAnnotation(spec, a.id, { text: e.target.value }))} />
                <button type="button" className="text-red-700 dark:text-red-300" aria-label={t("studio.annotation.remove")} onClick={() => edit(removeAnnotation(spec, a.id))}>×</button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              <button type="button" className={btn} onClick={() => edit(addAnnotation(spec, { id: `a${Date.now()}`, type: "LINE", value: 0, text: "" }))}>{t("studio.annotation.add")}: {t("studio.annotation.line")}</button>
              <button type="button" className={btn} onClick={() => edit(addAnnotation(spec, { id: `a${Date.now()}`, type: "BAND", from: 0, to: 1, text: "" }))}>{t("studio.annotation.add")}: {t("studio.annotation.band")}</button>
              <button type="button" className={btn} onClick={() => edit(addAnnotation(spec, { id: `a${Date.now()}`, type: "NOTE", text: "Note" }))}>{t("studio.annotation.add")}: {t("studio.annotation.note")}</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
