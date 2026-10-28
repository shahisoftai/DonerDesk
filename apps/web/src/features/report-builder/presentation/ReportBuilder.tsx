"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { REPORT_DIMENSIONS, reportCsv, runReport, toDatasetQuery, validateReportQuery, type ReportQuery, type ReportTable } from "@donordesk/domain/contexts/reporting/report-query.js";
import type { DatasetResult } from "@donordesk/domain/contexts/reporting/dataset-query.js";
import { resolveChartDatasetAction } from "@/lib/actions/charts";
import { deleteSavedReportAction, listSavedReportsAction, saveReportAction } from "@/lib/actions/saved-reports";
import type { SavedReportView } from "@/lib/server/schemas-saved-reports";
import { addDashboardChartAction, listDashboardsAction } from "@/lib/actions/dashboards";
import type { DashboardSummary } from "@/lib/server/schemas-dashboards";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

interface Props {
  projectId: string;
  indicators: Array<{ id: string; code: string; name: string }>;
  periods: Array<{ id: string; label: string }>;
  initialReports: SavedReportView[];
  canShare: boolean;
}

const sel = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-white/5";
const MEASURES = ["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"] as const;

/** The sentence-style report builder. The query is the whole report: it is saved, and run against the data sheet each time it is opened. */
export function ReportBuilder({ projectId, indicators, periods, initialReports, canShare }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState<ReportQuery>({ indicatorIds: indicators.slice(0, 3).map((i) => i.id), measure: "PERIOD", rows: "INDICATOR", includeDraft: true });
  const [table, setTable] = useState<ReportTable | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState(initialReports);
  const [current, setCurrent] = useState<{ id: string; updatedAt: string } | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"MINE" | "PROJECT">("MINE");
  const [message, setMessage] = useState<string | null>(null);

  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [dashboardId, setDashboardId] = useState("");
  useEffect(() => { void listDashboardsAction(projectId).then((r) => { if (r.ok) setDashboards(r.value.filter((d) => d.canEdit)); }); }, [projectId]);

  const periodName = useCallback((id: string | undefined, fallback: string) => periods.find((p) => p.id === id)?.label ?? fallback, [periods]);
  const sentence = useMemo(() => {
    const verified = t(query.includeDraft ? "rb.sentence.draft" : "rb.sentence.verifiedOnly");
    if (query.breakdown) return t("rb.sentence.group", { count: query.indicatorIds.length, period: periodName(query.toPeriodId, t("rb.lastPeriod")), dimension: t(`rb.dim.${query.breakdown}`), verified });
    const range = query.fromPeriodId || query.toPeriodId ? t("rb.sentence.range.some", { from: periodName(query.fromPeriodId, t("rb.firstPeriod")), to: periodName(query.toPeriodId, t("rb.lastPeriod")) }) : t("rb.sentence.range.all");
    return t("rb.sentence.main", { count: query.indicatorIds.length, range, measure: t(`rb.measure.${query.measure}`), rows: t(`rb.rows.${query.rows}`), verified });
  }, [query, periodName, t]);
  const problems = useMemo(() => validateReportQuery(query), [query]);
  const edit = (patch: Partial<ReportQuery>) => { setQuery((q) => ({ ...q, ...patch })); setTable(null); };

  const run = useCallback(async (q: ReportQuery) => {
    setBusy(true); setError(null);
    const r = await resolveChartDatasetAction(projectId, toDatasetQuery(q));
    setBusy(false);
    if (!r.ok) { setError(r.error.message); setTable(null); return; }
    if ("unavailable" in r.value) { setError(r.value.unavailable); setTable(null); return; }
    setTable(runReport(r.value.dataset as unknown as DatasetResult, q));
  }, [projectId]);

  function toggle(id: string) {
    edit({ indicatorIds: query.indicatorIds.includes(id) ? query.indicatorIds.filter((x) => x !== id) : [...query.indicatorIds, id] });
  }

  async function save(asNew: boolean) {
    setMessage(null);
    // Keys left unset are dropped, so a stored question holds only what was chosen.
    const body = { name: name.trim(), scope, projectId, query: JSON.parse(JSON.stringify(query)) as ReportQuery, ...(!asNew && current ? { expectedUpdatedAt: current.updatedAt } : {}) };
    const r = await saveReportAction(body, asNew ? undefined : current?.id);
    if (!r.ok) { setMessage(r.error.message); return; }
    setCurrent(r.value); setMessage(t("rb.saved"));
    const list = await listSavedReportsAction(projectId);
    if (list.ok) setReports(list.value);
  }

  function open(r: SavedReportView) {
    const q = r.query as unknown as ReportQuery;
    setQuery(q); setCurrent({ id: r.id, updatedAt: r.updatedAt }); setName(r.name); setScope(r.scope); setMessage(null);
    void run(q);
  }

  async function remove(r: SavedReportView) {
    if (!window.confirm(t("rb.confirmDelete", { name: r.name }))) return;
    const done = await deleteSavedReportAction(r.id);
    if (done.ok) { setReports((l) => l.filter((x) => x.id !== r.id)); if (current?.id === r.id) setCurrent(null); }
  }

  async function addToDashboard() {
    const r = await addDashboardChartAction(dashboardId, { projectId, report: query, title: name.trim() || undefined });
    setMessage(r.ok ? t("rb.added") : r.error.message);
  }

  function download() {
    if (!table) return;
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(reportCsv(table))}`;
    a.download = `${(name.trim() || "report").replace(/[^\w-]+/g, "-")}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("rb.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("rb.intro")}</p>
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-white/10" aria-label={t("rb.question")}>
        <fieldset>
          <legend className="text-sm font-medium">{t("rb.for")}</legend>
          <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
            {indicators.map((i) => (
              <label key={i.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={query.indicatorIds.includes(i.id)} onChange={() => toggle(i.id)} /> <span><span className="font-mono text-xs">{i.code}</span> {i.name}</span></label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label>{t("rb.from")} <select className={sel} aria-label={t("rb.from")} value={query.fromPeriodId ?? ""} disabled={!!query.breakdown} onChange={(e) => edit({ fromPeriodId: e.target.value || undefined })}><option value="">{t("rb.firstPeriod")}</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label>{t("rb.to")} <select className={sel} aria-label={t("rb.to")} value={query.toPeriodId ?? ""} onChange={(e) => edit({ toPeriodId: e.target.value || undefined })}><option value="">{t("rb.lastPeriod")}</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label>{t("rb.display")} <select className={sel} aria-label={t("rb.display")} value={query.measure} disabled={!!query.breakdown} onChange={(e) => edit({ measure: e.target.value as ReportQuery["measure"] })}>{MEASURES.map((v) => <option key={v} value={v}>{t(`rb.measure.${v}`)}</option>)}</select></label>
          <label>{t("rb.by")} <select className={sel} aria-label={t("rb.by")} value={query.breakdown ? "GROUP" : query.rows} onChange={(e) => { const v = e.target.value; if (v === "GROUP") edit({ rows: "INDICATOR", measure: "PERIOD", breakdown: query.breakdown ?? "SEX", fromPeriodId: undefined }); else edit({ rows: v as ReportQuery["rows"], breakdown: undefined }); }}><option value="INDICATOR">{t("rb.rows.INDICATOR")}</option><option value="PERIOD">{t("rb.rows.PERIOD")}</option><option value="GROUP">{t("rb.rows.GROUP")}</option></select></label>
          {query.breakdown && <label>{t("rb.group")} <select className={sel} aria-label={t("rb.group")} value={query.breakdown} onChange={(e) => edit({ breakdown: e.target.value as NonNullable<ReportQuery["breakdown"]> })}>{REPORT_DIMENSIONS.map((d) => <option key={d} value={d}>{t(`rb.dim.${d}`)}</option>)}</select></label>}
          <label className="flex items-center gap-1"><input type="checkbox" checked={query.includeDraft} onChange={(e) => edit({ includeDraft: e.target.checked })} /> {t("rb.includeDraft")}</label>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300" data-testid="sentence">{sentence}</p>
        {problems.length > 0 && <p role="alert" className="text-sm text-danger-600">{problems[0]!.message}</p>}
        <button type="button" className="btn-primary" disabled={busy || problems.length > 0} onClick={() => void run(query)}>{busy ? t("rb.running") : t("rb.run")}</button>
      </section>

      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      {table && (
        <section aria-label={t("rb.result")} className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm" data-testid="report-table">
              <thead><tr>{table.columns.map((c, i) => <th key={i} scope="col" className={`px-3 py-2 font-medium ${i === 0 ? "text-start" : "text-end"}`}>{i === 0 ? t(query.rows === "PERIOD" && !query.breakdown ? "rb.col.period" : "rb.col.indicator") : query.breakdown && i === table.columns.length - 1 ? t("rb.col.total") : c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-white/5"><th scope="row" className="px-3 py-2 text-start font-normal">{r.label}</th>{r.cells.map((c, j) => <td key={j} className="px-3 py-2 text-end tabular-nums">{c ?? <span className="text-slate-400">{t("indicatorViews.notMeasured")}</span>}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          {table.notes.length > 0 && <ul className="space-y-1 text-xs text-slate-500">{table.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <button type="button" className="btn-secondary" onClick={download}>{t("rb.download")}</button>
          {dashboards.length === 0 ? <p className="text-xs text-slate-500">{t("rb.noDashboards")}</p> : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select className={sel} aria-label={t("rb.chooseDashboard")} value={dashboardId} onChange={(e) => setDashboardId(e.target.value)}><option value="">{t("rb.chooseDashboard")}</option>{dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <button type="button" className="btn-secondary" disabled={!dashboardId || problems.length > 0} onClick={() => void addToDashboard()}>{t("rb.addToDashboard")}</button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10" aria-label={t("rb.keep")}>
        <h2 className="text-base font-semibold">{t("rb.keep")}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">{t("rb.name")} <input className={`${sel} block w-64`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
          {canShare && <label className="text-sm">{t("rb.whoSees")} <select className={`${sel} block`} value={scope} disabled={!!current} onChange={(e) => setScope(e.target.value as "MINE" | "PROJECT")}><option value="MINE">{t("rb.onlyMe")}</option><option value="PROJECT">{t("rb.projectWide")}</option></select></label>}
          <button type="button" className="btn-secondary" disabled={!name.trim() || problems.length > 0} onClick={() => void save(true)}>{t("rb.saveNew")}</button>
          {current && <button type="button" className="btn-secondary" disabled={!name.trim() || problems.length > 0} onClick={() => void save(false)}>{t("rb.saveChanges")}</button>}
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
        {reports.length > 0 && (
          <ul className="space-y-1 text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3">
                <button type="button" className="font-medium text-brand-700 underline dark:text-brand-300" onClick={() => open(r)}>{r.name}</button>
                <span className="text-xs text-slate-500">{r.scope === "PROJECT" ? t("rb.sharedWith") : t("rb.onlyMe")}</span>
                {r.canEdit && <button type="button" className="text-xs text-danger-600 underline" onClick={() => void remove(r)}>{t("rb.delete")}</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
