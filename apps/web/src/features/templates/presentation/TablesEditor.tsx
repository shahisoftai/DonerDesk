"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type RequiredTableDraft = { title: string; columns: string[]; notes?: string };

/** Tables the donor requires in a section: title plus column headers. */
export function TablesEditor({ tables, onChange }: { tables: RequiredTableDraft[]; onChange: (tables: RequiredTableDraft[]) => void }) {
  const set = (i: number, patch: Partial<RequiredTableDraft>) => onChange(tables.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">Required tables</legend>
      <p className="text-xs text-slate-500 dark:text-slate-400">The AI writer renders each as a table with exactly these columns, filled only from verified data.</p>
      {tables.length === 0 && <p className="text-xs italic text-slate-400">None.</p>}
      {tables.map((t, i) => (
        <div key={i} className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-white/10">
          <div className="flex gap-2">
            <Input aria-label="Table title" className="flex-1" value={t.title} placeholder="Table title" onChange={(e) => set(i, { title: e.target.value })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(tables.filter((_, j) => j !== i))} aria-label="Remove table">✕</Button>
          </div>
          <Input
            aria-label="Columns (comma separated)"
            value={t.columns.join(", ")}
            placeholder="Columns, comma separated (e.g. Indicator, Baseline, Target, Achieved)"
            onChange={(e) => set(i, { columns: e.target.value.split(",").map((c) => c.trimStart()) })}
          />
          <Input aria-label="Table notes" value={t.notes ?? ""} placeholder="Notes (optional)" onChange={(e) => set(i, { notes: e.target.value || undefined })} />
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...tables, { title: "", columns: [] }])}>Add table</Button>
    </fieldset>
  );
}
