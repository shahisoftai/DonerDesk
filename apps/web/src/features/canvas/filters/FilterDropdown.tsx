"use client";

import { useId, useMemo, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

export interface Option { key: string; label: string }
interface Props { label: string; options: readonly Option[]; chosen: readonly string[]; multi: boolean; search: boolean; selectedFirst: boolean; style: "DROPDOWN" | "LIST" | "TILES" | "BUTTONS"; tone: { strip: string; ink: string; on: string }; onChange: (keys: string[]) => void }

/**
 * One slicer (Phase 50.3, Power BI's slicer): a labelled strip with a dropdown (or a list, tiles or buttons). Several choices are ticked;
 * ticking every option is the same as none ("All"). The search box narrows long lists. Keyboard: the list is a group of checkboxes.
 */
export function FilterDropdown({ label, options, chosen, multi, search, selectedFirst, style, tone, onChange }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const f = q.trim().toLowerCase();
    const list = options.filter((o) => !f || o.label.toLowerCase().includes(f));
    return selectedFirst ? [...list.filter((o) => chosen.includes(o.key)), ...list.filter((o) => !chosen.includes(o.key))] : list;
  }, [options, q, chosen, selectedFirst]);
  const toggle = (k: string) => {
    let next = multi ? (chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k]) : chosen[0] === k ? [] : [k];
    if (multi && next.length >= options.length && options.length > 1) next = [];
    onChange(next);
  };
  const summary = chosen.length === 0 ? t("filter.all") : chosen.length === 1 ? options.find((o) => o.key === chosen[0])?.label ?? chosen[0]! : t("filter.chosen", { count: chosen.length });
  const list = (
    <div className="space-y-1">
      {search && options.length > 6 && <input type="search" aria-label={t("filter.search")} placeholder={t("filter.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900" />}
      <div role="group" aria-labelledby={id} className={style === "TILES" || style === "BUTTONS" ? "flex flex-wrap gap-1" : "max-h-56 space-y-0.5 overflow-y-auto"}>
        {multi && style !== "BUTTONS" && <label className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" checked={chosen.length === 0} onChange={() => onChange([])} />{t("filter.selectAll")}</label>}
        {shown.map((o) => style === "TILES" || style === "BUTTONS"
          ? <button key={o.key} type="button" aria-pressed={chosen.includes(o.key)} onClick={() => toggle(o.key)} style={chosen.includes(o.key) ? { background: tone.on, color: "#fff" } : undefined} className={`min-h-8 rounded px-2 text-xs ${chosen.includes(o.key) ? "" : "border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900"}`}>{o.label}</button>
          : <label key={o.key} className="flex min-h-8 items-center gap-2 text-xs"><input type={multi ? "checkbox" : "radio"} name={id} checked={chosen.includes(o.key)} onChange={() => toggle(o.key)} />{o.label}</label>)}
      </div>
    </div>
  );
  return (
    <div className="min-w-0 flex-1" data-filter={label}>
      <p id={id} className="break-words rounded-t px-2 py-0.5 text-xs font-bold" style={{ background: tone.strip, color: tone.ink }}>{label}</p>
      {style === "DROPDOWN"
        ? <details className="relative">
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between rounded-b border border-t-0 border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-900"><span className="break-words">{summary}</span><span aria-hidden>▾</span></summary>
            <div className="absolute start-0 z-20 mt-1 w-64 max-w-[80vw] rounded border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">{list}</div>
          </details>
        : <div className="rounded-b border border-t-0 border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900">{list}</div>}
    </div>
  );
}
