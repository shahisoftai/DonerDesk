"use client";

import { useState } from "react";
import type { BlockModel, DataSlicerModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useDatasetFilters } from "@/features/canvas/filters/dataset-filters";
import { NothingToShow, screenText } from "@/features/canvas/presentation/screens/screen-text";

/**
 * A slicer (Phase 54, §3.7): the values of one dataset column as buttons, with how many rows each has. Choosing narrows every dataset
 * visual on the page that reads the same dataset; a search box appears when the list is long. Keyboard: the buttons are a group.
 */
export function DataSlicerScreen({ model, frame }: { model: BlockModel<DataSlicerModel>; frame: PaintFrame }) {
  const { t } = useI18n();
  const filters = useDatasetFilters();
  const [find, setFind] = useState("");
  if (model.state !== "ready") return <NothingToShow text={screenText(frame)} reason={model.reason} authoring={model.state === "empty" && model.authoring} />;
  const m = model.model;
  const chosen = filters?.values(m.source, m.column) ?? [];
  const shown = find ? m.options.filter((o) => o.value.toLowerCase().includes(find.toLowerCase())) : m.options;
  return (
    <div className="flex h-full flex-col gap-1 px-3 py-2" role="group" aria-label={m.label}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{m.label}</span>
        {chosen.length > 0 && filters && <button type="button" className="text-xs underline" onClick={() => filters.clear(m.source, m.column)}>{t("ds.slicer.all")}</button>}
      </div>
      {m.options.length > 12 && <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("ds.slicer.find")} aria-label={t("ds.slicer.find")} className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900" />}
      <div className="flex min-h-0 flex-wrap gap-1 overflow-auto">
        {shown.map((o) => {
          const on = chosen.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} disabled={!filters} onClick={() => filters?.toggle(m.source, m.column, o.value, m.multi)}
              className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"}`}>
              {o.value} <span className={on ? "text-sky-100" : "text-slate-400"}>{o.rows}</span>
            </button>
          );
        })}
      </div>
      {model.notes.map((n, i) => <p key={i} className="text-[11px] text-slate-500">{n}</p>)}
    </div>
  );
}
