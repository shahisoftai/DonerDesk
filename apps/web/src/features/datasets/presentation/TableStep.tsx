"use client";

import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { UploadPreview } from "../domain/types";

/** Screen 2: which sheet, and which row holds the headers ("Headers look like row 3 — change"). */
export function TableStep({ upload, onBack, onNext }: { upload: UploadPreview; onBack: () => void; onNext: (sheet: string, headerRow: number) => void }) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState(upload.sheet);
  const [row, setRow] = useState(upload.headerRow);
  const preview = upload.sheets.find((s) => s.name === sheet)?.preview ?? [];
  return (
    <div className="space-y-4">
      {upload.sheets.length > 1 && (
        <fieldset className="space-y-2"><legend className="text-sm font-medium">{t("ds.table.sheet")}</legend>
          <div className="flex flex-wrap gap-2">{upload.sheets.map((s) => <button key={s.name} type="button" aria-pressed={s.name === sheet} onClick={() => setSheet(s.name)} className={`rounded border px-3 py-1 text-sm ${s.name === sheet ? "border-sky-700 bg-sky-50 dark:bg-sky-950" : "border-slate-300 dark:border-slate-600"}`}>{s.name} <span className="text-xs text-slate-500">{t("ds.table.rows", { n: s.rows })}</span></button>)}</div>
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-sm">{t("ds.table.headerRow")}
        <input type="number" min={1} max={50} value={row} onChange={(e) => setRow(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="w-20 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" />
      </label>
      <p className="text-xs text-slate-500">{t("ds.table.headerGuess", { row: upload.headerRow })}</p>
      <div className="overflow-auto rounded border border-slate-200 dark:border-slate-700">
        <table className="text-xs">
          <tbody>{preview.map((r, i) => <tr key={i} className={i + 1 === row ? "bg-sky-50 font-semibold dark:bg-sky-950" : ""}><th scope="row" className="px-2 py-1 text-slate-400">{i + 1}</th>{r.map((c, k) => <td key={k} className="whitespace-nowrap px-2 py-1">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="flex gap-2"><button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={onBack}>{t("ds.back")}</button><button type="button" className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white" onClick={() => onNext(sheet, row)}>{t("ds.next")}</button></div>
    </div>
  );
}
