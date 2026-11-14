"use client";

import { useMemo, useState } from "react";
import { AGGREGATE_DEFS, catalogueWith, suggestFamily, visualFamilyDef, wellRefusal, type DataSourceDef, type VisualFamily, type WellKey, type Wells } from "@donordesk/domain/contexts/visual-data/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { DatasetSourceView } from "./use-dataset-catalogue";

const DRAG_TYPE = "application/x-donordesk-field";

/**
 * Field wells (Phase 54, §3.6): drag a field from the list into Axis, Values, Legend… A field a well cannot take is refused with the
 * reason, where it was dropped. Keyboard and touch: pick a field (Enter or tap), then choose the well from the buttons that appear.
 */
export function WellsEditor({ source, family, wells, onChange }: { source: DatasetSourceView; family: string; wells: Wells; onChange: (w: Wells) => void }) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const def = visualFamilyDef(family);
  const cat = useMemo(() => catalogueWith([source as unknown as DataSourceDef]), [source]);
  if (!def) return null;
  const add = (well: WellKey, ref: string): void => {
    const why = wellRefusal(family as VisualFamily, well, ref, source.id, cat, wells);
    if (why) { setRefusal(why); return; }
    setRefusal(null); setPicked(null);
    onChange({ ...wells, [well]: [...(wells[well] ?? []), { ref }] });
  };
  const remove = (well: WellKey, i: number) => onChange({ ...wells, [well]: (wells[well] ?? []).filter((_, k) => k !== i) });
  const setAgg = (well: WellKey, i: number, aggregate: string) => onChange({ ...wells, [well]: (wells[well] ?? []).map((f, k) => (k === i ? { ...f, ...(aggregate ? { aggregate: aggregate as never } : { aggregate: undefined }) } : f)) });
  const label = (ref: string) => source.fields.find((f) => f.id === ref)?.label ?? ref;
  const suggestion = suggestFamily(wells, source.id, cat);
  return (
    <div className="space-y-2" data-testid="wells">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("ds.wells.fields")}</p>
      <ul className="flex max-h-36 flex-wrap gap-1 overflow-auto" aria-label={t("ds.wells.fields")}>
        {source.fields.map((f) => (
          <li key={f.id}><button type="button" draggable onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, f.id)} onClick={() => setPicked(picked === f.id ? null : f.id)} aria-pressed={picked === f.id}
            className={`rounded border px-2 py-0.5 text-xs ${picked === f.id ? "border-brand-700 bg-brand-50 dark:bg-brand-950" : "border-slate-300 dark:border-slate-600"}`} title={f.meaning}>
            {f.role === "MEASURE" ? "Σ " : ""}{f.label}</button></li>
        ))}
      </ul>
      {refusal && <p role="alert" className="text-xs text-red-700">{refusal}</p>}
      {def.wells.map((w) => (
        <div key={w.key} onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); add(w.key, e.dataTransfer.getData(DRAG_TYPE)); }}
          className="rounded border border-dashed border-slate-300 p-2 dark:border-slate-600" data-well={w.key}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{w.label}{w.required ? " *" : ""}</span>
            {picked && <button type="button" className="rounded bg-brand-700 px-2 py-0.5 text-xs text-white" onClick={() => add(w.key, picked)}>{t("ds.wells.addHere")}</button>}
          </div>
          {(wells[w.key] ?? []).length === 0 && <p className="text-[11px] text-slate-400">{t("ds.wells.drop")}</p>}
          {(wells[w.key] ?? []).map((f, i) => (
            <div key={`${f.ref}-${i}`} className="mt-1 flex items-center gap-1 text-xs">
              <span className="flex-1 truncate">{label(f.ref)}</span>
              {w.accepts !== "GROUP" && w.accepts !== "PLACE" && (
                <select aria-label={t("ds.wells.combine")} className="rounded border border-slate-300 px-1 text-xs dark:border-slate-600 dark:bg-slate-900" value={f.aggregate ?? ""} onChange={(e) => setAgg(w.key, i, e.target.value)}>
                  <option value="">{t("ds.wells.usual")}</option>
                  {AGGREGATE_DEFS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              )}
              <button type="button" aria-label={t("ds.wells.remove", { field: label(f.ref) })} className="px-1 text-red-700" onClick={() => remove(w.key, i)}>×</button>
            </div>
          ))}
        </div>
      ))}
      {Object.values(wells).some((x) => x?.length) && suggestion.family !== family && <p className="text-[11px] text-slate-500">{t("ds.wells.suggest", { family: visualFamilyDef(suggestion.family)?.label ?? suggestion.family })} {suggestion.reason}</p>}
      <p className="text-[11px] text-slate-500">{t("ds.wells.tabletHint")}</p>
    </div>
  );
}
