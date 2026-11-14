"use client";

import { useState } from "react";
import type { TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { CheckResult, UploadPreview } from "../domain/types";

/**
 * Screen 6: the problems, grouped and naming the row, and the save. A blocking problem stops the save; warnings save with a note. The
 * person can download their own sheet with a Problems column. On a refresh the diff ("+106 rows for 2022-08, 3 changed") comes first.
 */
export function CheckStep({ check, upload, steps, refresh, mode, onMode, projects, project, onProject, canCreateOrg, busy, onBack, onSave }: {
  check: CheckResult; upload: UploadPreview; steps: TidyStep[]; refresh: boolean; mode: "REPLACE" | "ADD_PERIODS"; onMode: (m: "REPLACE" | "ADD_PERIODS") => void;
  projects: Array<{ id: string; title: string }>; project: string; onProject: (id: string) => void; canCreateOrg: boolean; busy: boolean; onBack: () => void;
  onSave: (meta: { name: string; description: string; scope: "PROJECT" | "ORGANISATION" }) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(upload.fileName.replace(/\.[^.]*$/, "").slice(0, 120));
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"PROJECT" | "ORGANISATION">(projects.length ? "PROJECT" : "ORGANISATION");
  const blocking = check.findings.filter((f) => f.severity === "BLOCK");
  const warnings = check.findings.filter((f) => f.severity !== "BLOCK");
  async function download(): Promise<void> {
    const r = await fetch("/api/datasets/problems", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileKey: upload.fileKey, steps, columns: check.columns, all: false }) });
    if (!r.ok) return;
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "problems.csv" });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      {refresh && (
        <fieldset className="space-y-1 text-sm"><legend className="font-medium">{t("ds.check.how")}</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "ADD_PERIODS"} onChange={() => onMode("ADD_PERIODS")} />{t("ds.check.addPeriods")}</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "REPLACE"} onChange={() => onMode("REPLACE")} />{t("ds.check.replace")}</label>
          {check.diff && <p className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-900" data-testid="refresh-diff">{check.diff.summary}</p>}
        </fieldset>
      )}
      <p className="text-sm">{t("ds.check.rows", { n: check.rowCount.toLocaleString() })}</p>
      {check.findings.length === 0 ? <p className="text-sm text-emerald-800">{t("ds.check.clean")}</p> : (
        <div className="space-y-2">
          {blocking.length > 0 && <section><h3 className="text-sm font-semibold text-red-800">{t("ds.check.mustFix", { n: blocking.length })}</h3><ul className="list-disc ps-5 text-sm">{blocking.slice(0, 30).map((f, i) => <li key={i}>{f.message}</li>)}</ul></section>}
          {warnings.length > 0 && <section><h3 className="text-sm font-semibold text-amber-800">{t("ds.check.notes", { n: warnings.length })}</h3><ul className="list-disc ps-5 text-sm">{warnings.slice(0, 30).map((f, i) => <li key={i}>{f.message}</li>)}</ul></section>}
          <button type="button" className="text-sm underline" onClick={() => void download()}>{t("ds.check.download")}</button>
        </div>
      )}
      {!refresh && (
        <div className="grid max-w-xl gap-2 text-sm">
          <label className="space-y-1"><span className="block font-medium">{t("ds.check.name")}</span><input className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
          <label className="space-y-1"><span className="block font-medium">{t("ds.check.description")}</span><textarea rows={2} className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <fieldset className="space-y-1"><legend className="font-medium">{t("ds.check.belongs")}</legend>
            {projects.length > 0 && <label className="flex items-center gap-2"><input type="radio" checked={scope === "PROJECT"} onChange={() => setScope("PROJECT")} />{t("ds.check.toProject")}
              <select aria-label={t("ds.check.project")} className="rounded border border-slate-300 px-1 dark:border-slate-600 dark:bg-slate-900" value={project} onChange={(e) => onProject(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
            {canCreateOrg && <label className="flex items-center gap-2"><input type="radio" checked={scope === "ORGANISATION"} onChange={() => setScope("ORGANISATION")} />{t("ds.check.toOrg")}</label>}
          </fieldset>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={onBack}>{t("ds.back")}</button>
        <button type="button" disabled={busy || blocking.length > 0 || (!refresh && !name.trim()) || check.personal.length > 0} className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50" onClick={() => onSave({ name: name.trim(), description, scope })} data-testid="dataset-save">
          {warnings.length ? t("ds.check.saveAnyway") : t("ds.check.save")}
        </button>
      </div>
      {check.personal.length > 0 && <p className="text-xs text-amber-800">{t("ds.check.personalBlocks")}</p>}
    </div>
  );
}
