"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDataTable, DATA_TABLE_LAYOUTS, type DataTableLayout, type DataTableSpec } from "@donordesk/domain/contexts/reporting/data-tables.js";
import { CHART_MEASURES, PIVOT_MEASURE_LABEL, type ChartMeasure } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { getDataSheetAction } from "@/lib/actions/data-charts";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/**
 * "Table from data": pick indicators and periods from the project's Data Center and insert the table into the section text.
 * The table is a snapshot of the values as they are now; once inserted it is ordinary text, so it can be edited like any table.
 */
export function DataTableDialog({ projectId, open, onClose, onInsert }: { projectId: string; open: boolean; onClose: () => void; onInsert: (markdown: string) => void }) {
  const [sheet, setSheet] = useState<DataSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<DataTableSpec>({ layout: "SUMMARY", indicatorIds: [], measure: "PERIOD" });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open || sheet) return;
    let live = true;
    void getDataSheetAction(projectId).then((r) => {
      if (!live) return;
      if (!r.ok) { setError(r.error.message); return; }
      setError(null);
      setSheet(r.value);
      const withValues = new Set(r.value.cells.filter((c) => c.periodValue.trim() !== "" || c.cumulativeValue.trim() !== "").map((c) => c.indicatorId));
      setSpec((s) => ({ ...s, indicatorIds: r.value.indicators.filter((i) => withValues.has(i.id)).map((i) => i.id) }));
    });
    return () => { live = false; };
  }, [open, sheet, projectId]);

  const result = useMemo(() => (sheet ? buildDataTable(sheet, spec) : null), [sheet, spec]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (sheet?.indicators ?? []).filter((i) => !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [sheet, filter]);

  const update = (patch: Partial<DataTableSpec>): void => setSpec((s) => ({ ...s, ...patch }));
  const toggle = (id: string): void => setSpec((s) => ({ ...s, indicatorIds: s.indicatorIds.includes(id) ? s.indicatorIds.filter((x) => x !== id) : [...s.indicatorIds, id] }));

  return (
    <Dialog open={open} onClose={onClose} title="Insert a table from the Data Center" size="lg">
      {error && <p role="alert" className="mb-3 text-sm text-danger-700 dark:text-danger-300">{error}</p>}
      {!sheet ? <p className="text-sm text-slate-500">{error ? "" : "Loading the data…"}</p> : sheet.periods.length === 0 ? (
        <p className="text-sm text-slate-500">Create a reporting period and record values to build a table from them.</p>
      ) : (
        <div className="grid gap-4">
          <label className="block text-xs text-slate-500">
            Table
            <Select className="mt-1" value={spec.layout} onChange={(e) => update({ layout: e.target.value as DataTableLayout })}>
              {(Object.keys(DATA_TABLE_LAYOUTS) as DataTableLayout[]).map((l) => <option key={l} value={l}>{DATA_TABLE_LAYOUTS[l].label}</option>)}
            </Select>
            <span className="mt-1 block">{DATA_TABLE_LAYOUTS[spec.layout].description}</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-slate-500">
              From period
              <Select className="mt-1" value={spec.fromPeriodId ?? ""} onChange={(e) => update({ fromPeriodId: e.target.value || undefined })}>
                <option value="">First period</option>
                {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </label>
            <label className="block text-xs text-slate-500">
              To period
              <Select className="mt-1" value={spec.toPeriodId ?? ""} onChange={(e) => update({ toPeriodId: e.target.value || undefined })}>
                <option value="">Last period</option>
                {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </label>
            {spec.layout === "OVER_TIME" && (
              <label className="block text-xs text-slate-500">
                Show
                <Select className="mt-1" value={spec.measure} onChange={(e) => update({ measure: e.target.value as ChartMeasure })}>
                  {CHART_MEASURES.map((m) => <option key={m} value={m}>{PIVOT_MEASURE_LABEL[m]}</option>)}
                </Select>
              </label>
            )}
          </div>

          <fieldset>
            <legend className="text-xs text-slate-500">Indicators ({spec.indicatorIds.length} chosen)</legend>
            <Input className="mt-1" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find an indicator" aria-label="Find an indicator" />
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
              {shown.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" checked={spec.indicatorIds.includes(i.id)} onChange={() => toggle(i.id)} className="mt-1" />
                  <span><span className="font-mono text-xs text-slate-500">{i.code}</span> {i.name}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="text-xs text-slate-500">No indicator matches.</p>}
            </div>
            <div className="mt-1 flex gap-3 text-xs">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => update({ indicatorIds: shown.map((i) => i.id) })}>Choose all shown</button>
              <button type="button" className="text-brand-600 hover:underline" onClick={() => update({ indicatorIds: [] })}>Clear</button>
            </div>
          </fieldset>

          <div>
            <p className="text-xs font-medium text-slate-500">Preview</p>
            {result && !result.ok ? <p className="mt-1 text-sm text-slate-500">{result.reason}</p> : result && (
              <>
                <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-white/10" data-testid="data-table-preview">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/5"><tr>{result.headers.map((h, i) => <th key={i} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead>
                    <tbody>{result.rows.map((r, ri) => <tr key={ri} className="border-t border-slate-100 dark:border-white/10">{r.map((c, ci) => <td key={ci} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                <p className="mt-1 text-xs text-slate-500">The table shows the values as they are now. Once inserted it is ordinary text: it does not change when the data does.</p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button disabled={!result?.ok} onClick={() => { if (result?.ok) onInsert(result.markdown); }}>Insert table</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
