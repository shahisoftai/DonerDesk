"use client";

import { useState } from "react";
import { CameraButton } from "@/components/editor/CameraButton";
import { FileDropzone } from "@/components/editor/FileDropzone";
import { Select } from "@/components/ui/Select";
import { reduceImage } from "@/lib/client/reduce-image";
import { CONFIDENTIALITY_LABEL, CONFIDENTIALITY_OPTIONS, EVIDENCE_TYPE_LABEL, EVIDENCE_TYPE_OPTIONS } from "@/lib/labels";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { FileSettings, FileUploadOutcome } from "@/features/activities/domain/activity-evidence";

/**
 * One way to add photos and files to a record (Phase 44): take a photo, pick files or drop them; photos are made smaller before they
 * are kept; each file can say what it is, who may see it and which number it proves, behind one tap. The caller owns the list and the
 * upload (it knows the record the files belong to); this component only collects and describes them.
 */
export function FileCapture({
  files, onAdd, onRemove, settingsFor, onSettings, onApplyToAll, indicators = [], locked = false, uploadedNames = [], failures = [], uploading = false,
}: {
  files: readonly File[];
  onAdd: (files: File[]) => void;
  onRemove: (name: string) => void;
  settingsFor: (file: File) => FileSettings;
  onSettings: (file: File, patch: Partial<FileSettings>) => void;
  /** Offered when there are several files: copy the first file's choices to all of them. */
  onApplyToAll?: () => void;
  indicators?: ReadonlyArray<{ id: string; label: string }>;
  /** The record already exists: files can no longer be removed or described, only retried. */
  locked?: boolean;
  uploadedNames?: readonly string[];
  failures?: readonly FileUploadOutcome[];
  uploading?: boolean;
}) {
  const { t } = useI18n();
  const [working, setWorking] = useState(false);

  async function add(picked: File[]) {
    setWorking(true);
    try {
      // Photos are shrunk one at a time: several full-size decodes at once can run a small phone out of memory.
      const prepared: File[] = [];
      for (const f of picked) prepared.push(f.type.startsWith("image/") ? await reduceImage(f) : f);
      onAdd(prepared);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <FileDropzone multiple label={t("record.file.add")} hint={t("record.file.dropHint")} onFiles={(picked) => void add(picked)} />
      <div className="flex flex-wrap items-center gap-3">
        <CameraButton label={t("record.file.take")} onFiles={(picked) => void add(picked)} />
        <p className="text-xs text-slate-500 dark:text-slate-400">{working ? "…" : t("record.file.reduced")}</p>
      </div>
      {files.length > 1 && !locked && onApplyToAll && (
        <button type="button" className="min-h-11 text-start text-xs text-brand-700 underline dark:text-brand-300" onClick={onApplyToAll}>{t("record.file.applyAll")}</button>
      )}
      {files.length > 0 && (
        <ul className="space-y-2 text-sm" aria-label={t("record.file.listLabel")}>
          {files.map((f) => {
            const failure = failures.find((o) => o.name === f.name);
            const done = uploadedNames.includes(f.name);
            return (
              <li key={f.name} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  <span className="shrink-0 text-xs">
                    {done ? t("record.file.uploaded") : failure ? <span className="text-danger-700 dark:text-danger-400">{t("record.file.failed", { reason: failure.error ?? "" })}</span> : uploading ? t("record.file.sending") : t("record.file.waiting")}
                  </span>
                  {!done && !uploading && !locked && (
                    <button type="button" className="min-h-11 px-2 text-xs underline" onClick={() => onRemove(f.name)}>{t("record.file.remove")}</button>
                  )}
                </div>
                {!done && !locked && (
                  <details className="mt-1">
                    <summary className="min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("record.file.details")} ▾</summary>
                    <div className="grid gap-2 pb-1 sm:grid-cols-3">
                      <Select aria-label={t("record.file.type", { name: f.name })} value={settingsFor(f).evidenceType} onChange={(e) => onSettings(f, { evidenceType: e.target.value as FileSettings["evidenceType"] })}>
                        {EVIDENCE_TYPE_OPTIONS.map((x) => <option key={x} value={x}>{EVIDENCE_TYPE_LABEL[x] ?? x}</option>)}
                      </Select>
                      <Select aria-label={t("record.file.confidentiality", { name: f.name })} value={settingsFor(f).confidentialityLevel} onChange={(e) => onSettings(f, { confidentialityLevel: e.target.value as FileSettings["confidentialityLevel"] })}>
                        {CONFIDENTIALITY_OPTIONS.map((x) => <option key={x} value={x}>{CONFIDENTIALITY_LABEL[x] ?? x}</option>)}
                      </Select>
                      {indicators.length > 0 && (
                        <Select aria-label={t("record.file.indicator", { name: f.name })} value={settingsFor(f).indicatorId} onChange={(e) => onSettings(f, { indicatorId: e.target.value })}>
                          <option value="">{t("record.file.noIndicator")}</option>
                          {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                        </Select>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
