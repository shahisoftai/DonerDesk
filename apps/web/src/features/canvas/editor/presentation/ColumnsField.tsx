"use client";

import { TOTAL_FUNCTIONS, type TableColumnFormat } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const SEL = "rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900";

/** Per-column settings of a table (Phase 50.2): width, a total and whether a phone shows it. A rate column's sum is refused by the domain check. */
export function ColumnsField({ value, columns, onChange }: { value: TableColumnFormat[] | undefined; columns: readonly string[]; onChange: (v: TableColumnFormat[] | undefined) => void }) {
  const { t } = useI18n();
  const list = value ?? [];
  const put = (i: number, c: TableColumnFormat | null) => { const next = list.slice(); if (c) next[i] = c; else next.splice(i, 1); onChange(next.length ? next : undefined); };
  const free = columns.filter((k) => !list.some((c) => c.key === k));
  return (
    <div className="space-y-2" data-testid="columns-field">
      {list.map((c, i) => (
        <div key={c.key} className="flex flex-wrap items-center gap-1 rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
          <span className="min-w-0 flex-1 truncate font-medium">{c.key}</span>
          <select aria-label={t("cols.width")} className={SEL} value={typeof c.width === "number" ? "fixed" : c.width ?? "FIT"} onChange={(e) => put(i, { ...c, width: e.target.value === "fixed" ? 120 : (e.target.value as "FIT" | "GROW") })}>
            <option value="FIT">{t("cols.width.FIT")}</option><option value="GROW">{t("cols.width.GROW")}</option><option value="fixed">{t("cols.width.fixed")}</option>
          </select>
          {typeof c.width === "number" && <input type="number" min={40} max={800} aria-label={t("cols.width.fixed")} className="w-16 rounded border border-slate-300 px-1 py-0.5 dark:border-slate-600 dark:bg-slate-900" value={c.width} onChange={(e) => put(i, { ...c, width: Number(e.target.value) })} />}
          <select aria-label={t("cols.total")} className={SEL} value={c.total ?? "NONE"} onChange={(e) => put(i, { ...c, total: e.target.value as TableColumnFormat["total"] })}>{TOTAL_FUNCTIONS.map((f) => <option key={f} value={f}>{t(`cols.total.${f}` as never)}</option>)}</select>
          <label className="flex items-center gap-1"><input type="checkbox" checked={c.hideOnPhone === true} onChange={(e) => put(i, { ...c, hideOnPhone: e.target.checked || undefined })} />{t("cols.hideOnPhone")}</label>
          <button type="button" className="text-red-700 underline" onClick={() => put(i, null)}>{t("rules.remove")}</button>
        </div>
      ))}
      {free.length > 0 && (
        <select aria-label={t("cols.add")} className={SEL} value="" onChange={(e) => e.target.value && onChange([...list, { key: e.target.value }])}>
          <option value="">{t("cols.add")}</option>{free.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
    </div>
  );
}
