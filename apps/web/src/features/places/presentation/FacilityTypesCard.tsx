"use client";

import { useEffect, useState } from "react";
import { getFacilityTypesAction, saveFacilityTypesAction } from "@/lib/actions/facility-types";
import type { FacilityTypes } from "@/lib/server/schemas-facility-types";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

type Row = { key: string; label: string };

/**
 * The organisation's facility types (Phase 50.3b): OTP, SC, a school… An administrator adds them, or takes a starting list for a sector;
 * everyone else reads them. A count of facilities by type reads only places marked with one of these.
 */
export function FacilityTypesCard() {
  const { t } = useI18n();
  const [data, setData] = useState<FacilityTypes | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { void getFacilityTypesAction().then((r) => { if (r.ok) { setData(r.value); setRows(r.value.types); } }); }, []);
  if (!data) return null;
  const save = async (next: Row[]) => {
    const r = await saveFacilityTypesAction(next);
    if (r.ok) { setRows(r.value.types); setMsg({ ok: true, text: "Saved." }); } else setMsg({ ok: false, text: r.error.message });
  };
  return (
    <details className="card" data-testid="facility-types">
      <summary className="cursor-pointer text-sm font-semibold">{t("facility.types")} ({rows.length})</summary>
      <ul className="mt-2 space-y-1">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <input aria-label="Key" disabled={!data.canEdit} className="w-28 rounded border border-slate-300 px-2 py-1 uppercase dark:border-slate-600 dark:bg-slate-900" value={row.key} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") } : x)))} />
            <input aria-label="Name" disabled={!data.canEdit} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={row.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            {data.canEdit && <button type="button" className="text-xs text-red-700 underline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>{t("rules.remove")}</button>}
          </li>
        ))}
      </ul>
      {data.canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600" onClick={() => setRows([...rows, { key: "", label: "" }])}>+</button>
          <select aria-label="Starting list" className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900" value="" onChange={(e) => { const add = data.suggested[e.target.value] ?? []; setRows([...rows, ...add.filter((a) => !rows.some((r) => r.key === a.key)).map((a) => ({ key: a.key, label: a.label }))]); }}>
            <option value="">Add a starting list…</option>{Object.keys(data.suggested).map((k) => <option key={k} value={k}>{k.replace(/_/g, " ").toLowerCase()}</option>)}
          </select>
          <button type="button" className="rounded bg-sky-700 px-3 py-1 text-xs text-white" onClick={() => void save(rows.filter((r) => r.key && r.label))}>Save</button>
          {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-emerald-700" : "text-red-700"}>{msg.text}</span>}
        </div>
      )}
    </details>
  );
}
