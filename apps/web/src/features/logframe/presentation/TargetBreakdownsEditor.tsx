"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { BreakdownTargetRow } from "../domain/target-breakdown-rows";

export const BREAKDOWN_DIMENSION_LABEL: Record<string, string> = {
  SEX: "Sex",
  AGE_GROUP: "Age group",
  DISABILITY: "Disability",
  LOCATION: "Location",
  OTHER: "Other",
};


/**
 * Target for each group within the indicator's total (phase 28.1-B): e.g. Women 150, Children under 5 boys 60. The server
 * checks that a summable indicator's groups add up to its total target.
 */
export function TargetBreakdownsEditor({ rows, onChange, disabled }: { rows: BreakdownTargetRow[]; onChange: (rows: BreakdownTargetRow[]) => void; disabled?: boolean }) {
  function update(index: number, patch: Partial<BreakdownTargetRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Target for each group</legend>
      <p className="text-xs text-slate-500">Leave a row empty to skip it. Groups in one dimension should add up to the total target.</p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <label htmlFor={`bt-dim-${i}`} className="block text-xs text-slate-600 dark:text-slate-300">Dimension</label>
            <select id={`bt-dim-${i}`} value={row.dimension} disabled={disabled} onChange={(e) => update(i, { dimension: e.target.value })} className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-slate-900">
              {Object.entries(BREAKDOWN_DIMENSION_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`bt-cat-${i}`} className="block text-xs text-slate-600 dark:text-slate-300">Group</label>
            <Input id={`bt-cat-${i}`} value={row.category} disabled={disabled} placeholder="e.g. Women" onChange={(e) => update(i, { category: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`bt-val-${i}`} className="block text-xs text-slate-600 dark:text-slate-300">Target</label>
            <Input id={`bt-val-${i}`} inputMode="numeric" value={row.value} disabled={disabled} placeholder="e.g. 150" onChange={(e) => update(i, { value: e.target.value })} />
          </div>
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onChange([...rows, { dimension: "SEX", category: "", value: "" }])}>Add a group</Button>
    </fieldset>
  );
}
