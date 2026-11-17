"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { filterFields, suggestVisualFor, type DataField, type DataIntent } from "../domain/data-fields";

interface Props { indicators: ReadonlyArray<DataField>; projectName: string | undefined; onAdd: (kind: string, props: unknown) => void }

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:border-brand-500 hover:bg-brand-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-brand-950";

/** All of the project's indicators, ready to use: tick one or several and choose what to make of them. A new page starts with this open, not with three indicators picked for you. */
export function DataPanel({ indicators, projectName, onAdd }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const shown = useMemo(() => filterFields(indicators, query), [indicators, query]);
  const toggle = (id: string): void => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const make = (ids: string[], intent: DataIntent): void => { const v = suggestVisualFor(ids, intent); if (v) onAdd(v.kind, v.props); };
  const ids = [...picked];
  return (
    <section aria-label={t("v61.data.title")} data-testid="data-panel" className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("v61.data.title")}{projectName ? ` · ${projectName}` : ""}</h3>
      {indicators.length === 0
        ? <p className="text-xs text-slate-500">{t("v61.data.none")}</p>
        : (
          <>
            <input type="search" aria-label={t("v61.data.search")} placeholder={t("v61.data.search")} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" />
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("v61.data.makeFromPicked")}>
              <button type="button" className={BTN} disabled={ids.length === 0} onClick={() => make(ids, "CHART")} data-testid="data-chart-picked">{t("v61.data.chart", { count: String(ids.length) })}</button>
              <button type="button" className={BTN} disabled={ids.length < 2} onClick={() => make(ids, "COMPARE")}>{t("v61.data.compare")}</button>
              <button type="button" className={BTN} disabled={ids.length === 0} onClick={() => make(ids, "TABLE")}>{t("v61.data.table")}</button>
              {picked.size > 0 && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setPicked(new Set())}>{t("v61.data.clear")}</button>}
            </div>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto" data-testid="data-fields">
              {shown.map((f) => (
                <li key={f.id} className="flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" aria-label={`${f.code} ${f.name}`} checked={picked.has(f.id)} onChange={() => toggle(f.id)} className="mt-1" />
                  <span className="min-w-0 flex-1 break-words text-xs"><span className="font-mono text-[11px] text-slate-500">{f.code}</span> {f.name}</span>
                  <span className="flex shrink-0 gap-0.5">
                    <button type="button" className={BTN} title={t("v61.data.asNumber")} aria-label={`${t("v61.data.asNumber")}: ${f.code}`} onClick={() => make([f.id], "NUMBER")}>#</button>
                    <button type="button" className={BTN} title={t("v61.data.asChart")} aria-label={`${t("v61.data.asChart")}: ${f.code}`} onClick={() => make([f.id], "CHART")}>▥</button>
                  </span>
                </li>
              ))}
              {shown.length === 0 && <li className="text-xs text-slate-500">{t("drawer.noMatch")}</li>}
            </ul>
          </>
        )}
    </section>
  );
}
