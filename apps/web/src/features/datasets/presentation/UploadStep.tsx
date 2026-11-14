"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { uploadDatasetFileAction } from "@/lib/actions/datasets";
import type { KitView, UploadPreview } from "../domain/types";

/** Screen 1: drag a file or browse (xlsx or csv, up to 20 MB), or start from a kit's template sheet. */
export function UploadStep({ kits, onUploaded }: { kits: KitView[]; onUploaded: (u: UploadPreview) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError(t("ds.upload.tooBig")); return; }
    setBusy(true); setError(null);
    const form = new FormData();
    form.set("file", file);
    const r = await uploadDatasetFileAction(form);
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    onUploaded(r.value);
  }
  return (
    <div className="space-y-4">
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void send(e.dataTransfer.files[0]); }}
        className={`rounded-lg border-2 border-dashed p-8 text-center ${over ? "border-brand-600 bg-brand-50 dark:bg-brand-950" : "border-slate-300 dark:border-slate-600"}`}>
        <p className="font-medium">{t("ds.upload.drop")}</p>
        <p className="mt-1 text-sm text-slate-500">{t("ds.upload.types")}</p>
        <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label={t("ds.upload.browse")} onChange={(e) => { const f = e.target.files?.[0]; void send(f); }} data-testid="dataset-file" />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="mt-3 rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">{busy ? t("ds.upload.reading") : t("ds.upload.browse")}</button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("ds.upload.personal")}</p>
      <div className="text-sm">
        <p className="font-medium">{t("ds.upload.noFile")}</p>
        <ul className="mt-1 flex flex-wrap gap-3">{kits.map((k) => <li key={k.key}><a className="underline" href={`/api/dataset-kits/${k.key}/template`}>{t("ds.kit.template", { kit: k.title })}</a></li>)}</ul>
        <p className="mt-1 text-xs text-slate-500">{t("ds.upload.connectHint")}</p>
      </div>
    </div>
  );
}
