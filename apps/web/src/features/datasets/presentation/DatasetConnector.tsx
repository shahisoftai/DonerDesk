"use client";

import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { pullDatasetConnectorAction, saveDatasetConnectorAction } from "@/lib/actions/datasets";
import type { DatasetDetail } from "../domain/types";

const INPUT = "w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";
const split = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

/**
 * A DHIS2 connector (§3.10, J8): the server, data elements, organisation units and periods; a key kept encrypted and never shown again;
 * a schedule. "Pull now" adds new periods through the same checks as an upload; the last pull's result (or failure) is shown.
 */
export function DatasetConnector({ dataset, onChanged }: { dataset: DatasetDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const c = (dataset.connectorConfig ?? {}) as { serverUrl?: string; dataElements?: string[]; orgUnits?: string[]; periods?: string; schedule?: string };
  const [f, setF] = useState({ serverUrl: c.serverUrl ?? "", dataElements: (c.dataElements ?? []).join(", "), orgUnits: (c.orgUnits ?? []).join(", "), periods: c.periods ?? "LAST_12_MONTHS", schedule: c.schedule ?? "MONTHLY", credential: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(): Promise<void> {
    setBusy(true);
    const r = await saveDatasetConnectorAction(dataset.id, { config: { kind: "DHIS2", serverUrl: f.serverUrl.trim(), dataElements: split(f.dataElements), orgUnits: split(f.orgUnits), periods: f.periods.trim(), schedule: f.schedule }, ...(f.credential ? { credential: f.credential } : {}) });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: t("ds.saved") } : { ok: false, text: r.error.message });
    if (r.ok) { setF({ ...f, credential: "" }); onChanged(); }
  }
  async function pull(): Promise<void> {
    setBusy(true);
    const r = await pullDatasetConnectorAction(dataset.id);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.value.summary } : { ok: false, text: r.error.message });
    onChanged();
  }
  return (
    <div className="max-w-xl space-y-3 text-sm">
      <p className="text-slate-600 dark:text-slate-300">{t("ds.conn.intro")}</p>
      <label className="block space-y-1"><span>{t("ds.conn.server")}</span><input className={INPUT} placeholder="https://dhis2.example.org" value={f.serverUrl} onChange={(e) => setF({ ...f, serverUrl: e.target.value })} /></label>
      <label className="block space-y-1"><span>{t("ds.conn.elements")}</span><input className={INPUT} value={f.dataElements} onChange={(e) => setF({ ...f, dataElements: e.target.value })} /></label>
      <label className="block space-y-1"><span>{t("ds.conn.units")}</span><input className={INPUT} placeholder="LEVEL-3" value={f.orgUnits} onChange={(e) => setF({ ...f, orgUnits: e.target.value })} /></label>
      <label className="block space-y-1"><span>{t("ds.conn.periods")}</span><input className={INPUT} placeholder="LAST_12_MONTHS" value={f.periods} onChange={(e) => setF({ ...f, periods: e.target.value })} /></label>
      <label className="block space-y-1"><span>{t("ds.conn.schedule")}</span><select className={INPUT} value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })}>{["MANUAL", "DAILY", "WEEKLY", "MONTHLY"].map((s) => <option key={s} value={s}>{t(`ds.conn.${s}`)}</option>)}</select></label>
      <label className="block space-y-1"><span>{t("ds.conn.key")}</span><input type="password" autoComplete="off" className={INPUT} value={f.credential} placeholder={dataset.connectorConfig ? t("ds.conn.keyKept") : ""} onChange={(e) => setF({ ...f, credential: e.target.value })} /></label>
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="rounded bg-brand-700 px-3 py-1 text-white disabled:opacity-60" onClick={() => void save()}>{t("ds.save")}</button>
        {dataset.connectorConfig && <button type="button" disabled={busy} className="rounded border border-slate-300 px-3 py-1" onClick={() => void pull()}>{t("ds.conn.pull")}</button>}
        {dataset.connectorConfig && <button type="button" disabled={busy} className="px-2 text-red-700 underline" onClick={async () => { await saveDatasetConnectorAction(dataset.id, null); onChanged(); }}>{t("ds.tidy.remove")}</button>}
      </div>
      {dataset.lastPull && <p className="text-xs text-slate-500">{t("ds.conn.last", { at: dataset.lastPull.at ? new Date(dataset.lastPull.at).toLocaleString() : "", summary: dataset.lastPull.summary ?? "" })}</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-emerald-800" : "text-red-700"}>{msg.text}</p>}
    </div>
  );
}
