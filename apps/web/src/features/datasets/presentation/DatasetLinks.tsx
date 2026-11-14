"use client";

import { useEffect, useState } from "react";
import { columnKind } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { addDatasetLinkAction, datasetLinkSuggestionsAction, removeDatasetLinkAction, syncDatasetLinksAction } from "@/lib/actions/datasets";
import type { DatasetDetail } from "../domain/types";

/**
 * "Use this figure for indicator X" (§3.9, J5): one dialog. Values are written as drafts through the normal save, so a reviewer still
 * verifies them; a verified value is never changed, and a difference is noted. Suggestions name why they match; one tick links.
 */
export function DatasetLinks({ dataset, indicators, onChanged }: { dataset: DatasetDetail; indicators: Array<{ id: string; code: string; name: string; type: string }>; onChanged: () => void }) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<Array<{ column: string; indicatorId: string; indicator: string; reason: string }>>([]);
  const [figure, setFigure] = useState("");
  const [indicator, setIndicator] = useState("");
  const [byPlace, setByPlace] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (dataset.projectId) void datasetLinkSuggestionsAction(dataset.id).then((r) => r.ok && setSuggestions(r.value.suggestions)); }, [dataset.id, dataset.projectId]);
  if (!dataset.projectId) return <p className="text-sm text-slate-500">{t("ds.links.orgOnly")}</p>;
  const cols = dataset.current?.columns ?? [];
  const figures = [...cols.filter((c) => columnKind(c.kind)?.role === "FIGURE").map((c) => ({ id: c.key, label: c.label })), ...(dataset.current?.figures ?? []).map((f) => ({ id: f.id, label: f.label }))];
  const name = (id: string) => { const i = indicators.find((x) => x.id === id); return i ? `${i.code} ${i.name}` : id; };
  const link = async (fig: string, ind: string, place: boolean) => {
    const r = await addDatasetLinkAction(dataset.id, { indicatorId: ind, figureRef: fig, byPlace: place });
    if (!r.ok) { setMsg({ ok: false, text: r.error.message }); return; }
    setMsg({ ok: true, text: [t("ds.links.written", { n: r.value.written }), ...r.value.notes].join(" ") }); onChanged();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("ds.links.intro")}</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
      {dataset.links.length > 0 && (
        <ul className="space-y-1 text-sm">{dataset.links.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2"><span>{figures.find((f) => f.id === l.figureRef)?.label ?? l.figureRef} → {name(l.indicatorId)}{l.byPlace ? ` (${t("ds.links.byPlace")})` : ""}</span>
            {l.lastSync && <span className="text-xs text-slate-500">{t("ds.links.lastSync", { n: l.lastSync.written, at: new Date(l.lastSync.at).toLocaleString() })}</span>}
            {dataset.canManage && <button type="button" className="text-xs text-red-700 underline" onClick={async () => { await removeDatasetLinkAction(dataset.id, l.id); onChanged(); }}>{t("ds.tidy.remove")}</button>}
            {l.lastSync?.notes.map((n, i) => <span key={i} className="w-full text-xs text-amber-800">{n}</span>)}
          </li>))}</ul>
      )}
      {dataset.canManage && dataset.links.length > 0 && <button type="button" className="text-sm underline" onClick={async () => { const r = await syncDatasetLinksAction(dataset.id); setMsg(r.ok ? { ok: true, text: [t("ds.links.written", { n: r.value.written }), ...r.value.notes].join(" ") } : { ok: false, text: r.error.message }); onChanged(); }}>{t("ds.links.sync")}</button>}
      {dataset.canManage && suggestions.length > 0 && (
        <section><h3 className="text-sm font-semibold">{t("ds.links.suggested")}</h3>
          <ul className="space-y-1 text-sm">{suggestions.map((s) => <li key={`${s.column}-${s.indicatorId}`} className="flex flex-wrap items-center gap-2"><span>{cols.find((c) => c.key === s.column)?.label} → {s.indicator}</span><span className="text-xs text-slate-500">({s.reason})</span><button type="button" className="rounded border border-sky-700 px-2 py-0.5 text-xs text-sky-800" onClick={() => void link(s.column, s.indicatorId, false)}>{t("ds.links.use")}</button></li>)}</ul>
        </section>
      )}
      {dataset.canManage && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="space-y-1"><span className="block text-xs">{t("ds.links.figure")}</span><select className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={figure} onChange={(e) => setFigure(e.target.value)}><option value="">—</option>{figures.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs">{t("ds.links.indicator")}</span><select className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={indicator} onChange={(e) => setIndicator(e.target.value)}><option value="">—</option>{indicators.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}</select></label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={byPlace} onChange={(e) => setByPlace(e.target.checked)} />{t("ds.links.byPlace")}</label>
          <button type="button" disabled={!figure || !indicator} className="rounded bg-sky-700 px-3 py-1 text-white disabled:opacity-50" onClick={() => void link(figure, indicator, byPlace)}>{t("ds.links.add")}</button>
        </div>
      )}
    </div>
  );
}
