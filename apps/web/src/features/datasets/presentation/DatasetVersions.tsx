"use client";

import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { decideDatasetVersionAction, restoreDatasetVersionAction } from "@/lib/actions/datasets";
import type { DatasetDetail } from "../domain/types";

/** The last ten versions (§3.10): what each changed, uploads waiting for a decision (accept, or say why not), and restoring an older one. */
export function DatasetVersions({ dataset, onChanged }: { dataset: DatasetDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const act = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => { const r = await p; if (!r.ok) setError(r.error?.message ?? ""); else { setError(null); onChanged(); } };
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ul className="space-y-2">
        {dataset.versions.map((v) => (
          <li key={v.id} className="rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t("ds.page.version", { n: v.number })}</span>
              <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${v.status === "PENDING" ? "bg-amber-50 text-amber-900" : v.status === "REJECTED" ? "bg-red-50 text-red-900" : "bg-slate-100 dark:bg-slate-800"}`}>{t(`ds.version.${v.status}`)}</span>
              {dataset.current?.id === v.id && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-900">{t("ds.version.current")}</span>}
            </div>
            <p className="text-xs text-slate-600">{v.summary}</p>
            {v.decisionNote && <p className="text-xs text-slate-500">{v.decisionNote}</p>}
            {dataset.canManage && v.status === "PENDING" && (
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" className="rounded bg-sky-700 px-2 py-0.5 text-xs text-white" onClick={() => void act(decideDatasetVersionAction(dataset.id, v.id, true))}>{t("ds.version.accept")}</button>
                <input aria-label={t("ds.version.why")} placeholder={t("ds.version.why")} className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900" value={note[v.id] ?? ""} onChange={(e) => setNote({ ...note, [v.id]: e.target.value })} />
                <button type="button" className="rounded border border-red-700 px-2 py-0.5 text-xs text-red-700" onClick={() => void act(decideDatasetVersionAction(dataset.id, v.id, false, note[v.id]))}>{t("ds.version.reject")}</button>
              </div>
            )}
            {dataset.canManage && v.status === "ACCEPTED" && dataset.current?.id !== v.id && <button type="button" className="mt-1 text-xs underline" onClick={() => void act(restoreDatasetVersionAction(dataset.id, v.id))}>{t("ds.version.restore")}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
