"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { importPlaceSheetAction } from "@/lib/actions/place-entry";
import type { PlaceSheetImportResponse } from "@/lib/server/schemas-place-entry";

/**
 * Excel in the DevResults layout (Phase 57): download the period's values by place, fill it, upload it. The upload is checked first
 * and shows every problem; nothing is saved until the person applies a file with none.
 */
export function PlaceSheetFile({ projectId, periodId, canEdit, onApplied }: { projectId: string; periodId: string; canEdit: boolean; onApplied: () => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<PlaceSheetImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(chosen: File, apply: boolean) {
    setBusy(true); setError(null);
    const r = await importPlaceSheetAction(projectId, periodId, chosen, apply);
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setCheck(r.value);
    if (r.value.applied) { setFile(null); onApplied(); }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn-secondary btn-sm" href={`/api/projects/${encodeURIComponent(projectId)}/place-sheet/export?periodId=${encodeURIComponent(periodId)}`}>{t("placeSheet.download")}</a>
        {canEdit && (
          <>
            <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label={t("placeSheet.upload")} onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              e.target.value = "";
              setFile(chosen); setCheck(null);
              if (chosen) void run(chosen, false);
            }} />
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>{t("placeSheet.upload")}</button>
          </>
        )}
      </div>
      {busy && <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeSheet.checking")}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {check && check.problems.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-400/30 dark:bg-red-500/10">
          <p className="font-semibold">{t("placeSheet.problems")}</p>
          <ul className="mt-1 list-disc ps-5">{check.problems.slice(0, 30).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {check && !check.applied && check.problems.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{check.changes > 0 ? t("placeSheet.ready", { count: String(check.changes) }) : t("placeSheet.noChanges")}</span>
          {check.changes > 0 && file && <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void run(file, true)}>{t("placeSheet.apply")}</button>}
        </div>
      )}
      {check?.applied && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">{[t("placeSheet.applied"), ...check.notices].join(" ")}</p>}
    </div>
  );
}
