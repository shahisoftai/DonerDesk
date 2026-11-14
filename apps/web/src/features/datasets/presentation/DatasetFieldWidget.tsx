"use client";

import { useId } from "react";
import { getAt } from "@/features/canvas/domain/path";
import type { Field } from "@/features/canvas/domain/prop-fields";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useDatasetCatalogue } from "./use-dataset-catalogue";
import { WellsEditor } from "./WellsEditor";

const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";
type DatasetField = Extract<Field, { type: "dataset" | "datasetColumn" | "datasetColumns" | "wells" }>;

/** The dataset settings of a block (Phase 54): which dataset, which of its columns, and the wells of a visual. */
export function DatasetFieldWidget({ field, settings, onChange }: { field: DatasetField; settings: unknown; onChange: (path: string, value: unknown) => void }) {
  const { t } = useI18n();
  const id = useId();
  const { sources, loading } = useDatasetCatalogue();
  const value = getAt(settings, field.path);
  const label = <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</label>;
  if (field.type === "dataset") return (
    <div className="space-y-1">{label}
      <select id={id} className={INPUT} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field.path, e.target.value)}>
        <option value="">{loading ? t("ds.field.loading") : sources.length ? t("ds.field.choose") : t("ds.field.none")}</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {!loading && sources.length === 0 && <a className="text-xs underline" href="/visuals/datasets/new">{t("ds.list.new")}</a>}
    </div>
  );
  const source = sources.find((s) => s.id === getAt(settings, field.sourcePath));
  if (!source) return <p className="text-xs text-slate-500">{t("ds.field.pickDatasetFirst")}</p>;
  if (field.type === "wells") return <WellsEditor source={source} family={String(getAt(settings, field.familyPath) ?? "BAR")} wells={(value ?? {}) as Record<string, Array<{ ref: string; aggregate?: string }>>} onChange={(w) => onChange(field.path, w)} />;
  const fields = source.fields.filter((f) => !field.role || f.role === field.role);
  if (field.type === "datasetColumn") return (
    <div className="space-y-1">{label}
      <select id={id} className={INPUT} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field.path, e.target.value || undefined)}>
        <option value="">{t("ds.field.chooseColumn")}</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
    </div>
  );
  const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</legend>
      <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 dark:border-slate-700">
        {fields.map((f) => <label key={f.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.has(f.id)} onChange={(e) => { const next = new Set(chosen); if (e.target.checked) next.add(f.id); else next.delete(f.id); onChange(field.path, fields.filter((x) => next.has(x.id)).map((x) => x.id)); }} />{f.label}</label>)}
      </div>
    </fieldset>
  );
}
