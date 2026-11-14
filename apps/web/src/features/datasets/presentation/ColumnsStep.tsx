"use client";

import { useState } from "react";
import { COLUMN_KINDS, SEMANTICS, type ColumnDef, type TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { dropColumns, updateColumn } from "../domain/wizard";
import type { CheckResult, KitView } from "../domain/types";

/**
 * Screen 3: one row per column, its samples and why it was guessed; a low-confidence guess is highlighted. A column that looks like
 * personal data is offered for removal (the default). A kit that fits is offered here; choosing it applies the kit's kinds and checks.
 */
export function ColumnsStep({ check, kits, kitKey, steps, onBack, onApply, onNext }: {
  check: CheckResult; kits: KitView[]; kitKey: string | undefined; steps: TidyStep[];
  onBack: () => void; onApply: (next: { steps?: TidyStep[]; columns?: ColumnDef[] | undefined; kitKey?: string | undefined }) => void; onNext: () => void;
}) {
  const { t } = useI18n();
  const [cols, setCols] = useState<ColumnDef[]>(check.columns);
  const proposal = (key: string) => check.proposals.find((p) => p.key === key);
  const personal = new Set(check.personal.map((p) => p.header));
  const changed = JSON.stringify(cols) !== JSON.stringify(check.columns);
  return (
    <div className="space-y-4">
      {check.personal.length > 0 && (
        <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">{t("ds.columns.personalTitle")}</p>
          <ul className="mt-1 list-disc ps-5">{check.personal.map((p) => <li key={p.header}>{p.reason}</li>)}</ul>
          <button type="button" className="mt-2 rounded bg-amber-700 px-3 py-1 text-white" onClick={() => onApply({ steps: dropColumns(steps, check.personal.map((p) => p.header)), columns: undefined })}>{t("ds.columns.removePersonal")}</button>
        </div>
      )}
      {check.kitSuggestion && !kitKey && (
        <div className="rounded border border-sky-300 bg-sky-50 p-3 text-sm dark:bg-sky-950">
          <p>{check.kitSuggestion.sentence}</p>
          <button type="button" className="mt-2 rounded bg-sky-700 px-3 py-1 text-white" onClick={() => onApply({ kitKey: check.kitSuggestion!.key, columns: undefined })}>{t("ds.columns.useKit", { kit: check.kitSuggestion.title })}</button>
        </div>
      )}
      {check.kit && <p className="text-sm text-sky-900 dark:text-sky-100">{check.kit.sentence} {check.kit.reviewState === "UNREVIEWED" && <span className="text-amber-700">{t("ds.kit.unreviewed")}</span>}</p>}
      {!check.kit && !check.kitSuggestion && kits.length > 0 && (
        <label className="flex items-center gap-2 text-sm">{t("ds.columns.kit")}
          <select className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={kitKey ?? ""} onChange={(e) => onApply({ kitKey: e.target.value || undefined, columns: undefined })}>
            <option value="">{t("ds.columns.noKit")}</option>{kits.map((k) => <option key={k.key} value={k.key}>{k.title}</option>)}
          </select>
        </label>
      )}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-start text-xs text-slate-500"><th className="px-2 py-1 text-start">{t("ds.columns.header")}</th><th className="px-2 py-1 text-start">{t("ds.columns.samples")}</th><th className="px-2 py-1 text-start">{t("ds.columns.holds")}</th><th className="px-2 py-1 text-start">{t("ds.columns.means")}</th><th className="px-2 py-1">{t("ds.columns.hide")}</th></tr></thead>
          <tbody>
            {cols.map((c) => {
              const p = proposal(c.key);
              const low = (p?.confidence ?? 1) < 0.6;
              return (
                <tr key={c.key} className={`border-t border-slate-100 align-top dark:border-slate-800 ${low ? "bg-amber-50/60 dark:bg-amber-950/40" : ""}`} data-column={c.sourceHeader}>
                  <td className="px-2 py-1">
                    <input aria-label={t("ds.columns.name", { header: c.sourceHeader })} className="w-full rounded border border-slate-300 px-1 dark:border-slate-600 dark:bg-slate-900" value={c.label} onChange={(e) => setCols(updateColumn(cols, c.key, { label: e.target.value }))} />
                    {c.label !== c.sourceHeader && <p className="text-[11px] text-slate-400">{c.sourceHeader}</p>}
                    {personal.has(c.sourceHeader) && <p className="text-[11px] text-amber-800">{t("ds.columns.personalBadge")}</p>}
                  </td>
                  <td className="px-2 py-1 text-xs text-slate-500">{(p?.samples ?? []).join(" · ")}<p className="text-[11px] italic">{p?.reasons.join(" ")}</p></td>
                  <td className="px-2 py-1"><select aria-label={t("ds.columns.holds")} className="rounded border border-slate-300 px-1 dark:border-slate-600 dark:bg-slate-900" value={c.kind} onChange={(e) => setCols(updateColumn(cols, c.key, { kind: e.target.value as ColumnDef["kind"] }))}>{COLUMN_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></td>
                  <td className="px-2 py-1"><select aria-label={t("ds.columns.means")} className="rounded border border-slate-300 px-1 dark:border-slate-600 dark:bg-slate-900" value={c.semantic} onChange={(e) => { const sem = SEMANTICS.find((s) => s.key === e.target.value); setCols(updateColumn(cols, c.key, { semantic: e.target.value as ColumnDef["semantic"], ...(sem && !sem.shareable ? { hideOnShareLinks: true } : {}) })); }}>{SEMANTICS.filter((s) => s.kinds.includes(c.kind)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></td>
                  <td className="px-2 py-1 text-center"><input type="checkbox" aria-label={t("ds.columns.hide")} checked={c.hideOnShareLinks} onChange={(e) => setCols(updateColumn(cols, c.key, { hideOnShareLinks: e.target.checked }))} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={onBack}>{t("ds.back")}</button>
        {changed && <button type="button" className="rounded border border-sky-700 px-3 py-1.5 text-sm text-sky-800" onClick={() => onApply({ columns: cols })}>{t("ds.columns.recheck")}</button>}
        <button type="button" className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white" onClick={() => { if (changed) onApply({ columns: cols }); onNext(); }}>{t("ds.next")}</button>
      </div>
    </div>
  );
}
