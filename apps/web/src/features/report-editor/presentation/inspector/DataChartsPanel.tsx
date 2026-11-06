"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataChartSpec } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { DATA_CHART_TEMPLATES } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { addSectionDataChartAction, getDataSheetAction, listSectionDataChartsAction, moveSectionDataChartAction, refreshSectionDataChartAction, removeSectionDataChartAction, updateSectionDataChartAction } from "@/lib/actions/data-charts";
import type { DataSheetResponse, SectionDataChart } from "@/lib/server/schemas";
import { DataChartBuilder } from "@/features/data-center/presentation/DataChartBuilder";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/feedback/Dialog";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

type Editing = { mode: "add" } | { mode: "edit"; chart: SectionDataChart };

/**
 * The charts a person added to this section from the Data Center: add, edit, update to the latest data, reorder, remove.
 * A chart keeps the data it showed when it was added; it only changes when someone presses Update or saves an edit.
 */
export function DataChartsPanel({ projectId, sectionId, readOnly, sectionApproved = false, onChanged }: { projectId: string; sectionId: string; readOnly: boolean; sectionApproved?: boolean; onChanged: () => void }) {
  const [charts, setCharts] = useState<SectionDataChart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheet, setSheet] = useState<DataSheetResponse | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<SectionDataChart | null>(null);

  const load = useCallback(async () => {
    const r = await listSectionDataChartsAction(sectionId);
    if (!r.ok) { setError(r.error.message); return; }
    setError(null);
    setCharts(r.value);
  }, [sectionId]);

  useEffect(() => { void load(); }, [load]);

  async function openBuilder(next: Editing): Promise<void> {
    setSheetError(null);
    setCaption(next.mode === "edit" ? next.chart.caption : "");
    setEditing(next);
    if (sheet) return;
    const r = await getDataSheetAction(projectId);
    if (!r.ok) { setSheetError(r.error.message); return; }
    setSheet(r.value);
  }

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>): Promise<void> {
    setBusyId(id);
    setError(null);
    const r = await action();
    setBusyId(null);
    if (!r.ok) { setError(r.error?.message ?? "That did not work."); return; }
    await load();
    onChanged();
  }

  async function save(spec: DataChartSpec): Promise<void> {
    if (!editing) return;
    setSaving(true);
    setSheetError(null);
    const text = caption.trim();
    const r = editing.mode === "add"
      ? await addSectionDataChartAction(sectionId, { spec, ...(text ? { caption: text } : {}) })
      : await updateSectionDataChartAction(sectionId, editing.chart.id, { spec, caption: text || editing.chart.caption });
    setSaving(false);
    if (!r.ok) { setSheetError(r.error.message); return; }
    setEditing(null);
    await load();
    onChanged();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Charts from the Data Center</p>
        {!readOnly && <Button size="sm" variant="secondary" onClick={() => void openBuilder({ mode: "add" })}>Add chart</Button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-danger-700 dark:text-danger-300">{error}</p>}
      {charts === null ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : charts.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">None yet. Add a chart of monthly achievements, an indicator against its target, or budget against spending.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {charts.map((c, i) => (
            <li key={c.id} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
              <p className="text-sm font-medium">{c.caption}</p>
              <p className="text-xs text-slate-500">{DATA_CHART_TEMPLATES[c.spec.template].label}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.broken ? <Badge tone="danger" title={c.broken}>Cannot be redrawn</Badge> : c.stale ? <Badge tone="warning">Data has changed</Badge> : <Badge tone="success">Up to date</Badge>}
                {c.unverified > 0 && <Badge tone="warning" title="Draft values are plotted; the report shows a note.">{c.unverified} of {c.points} not verified</Badge>}
              </div>
              {c.broken && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{c.broken} The chart keeps showing the data it had; edit or remove it.</p>}
              {!readOnly && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.stale && !c.broken && <Button size="sm" disabled={busyId === c.id} pending={busyId === c.id} onClick={() => void run(c.id, () => refreshSectionDataChartAction(sectionId, c.id))}>Update</Button>}
                  <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => void openBuilder({ mode: "edit", chart: c })}>Edit</Button>
                  <Button size="sm" variant="ghost" aria-label={`Move ${c.caption} up`} disabled={i === 0 || busyId === c.id} onClick={() => void run(c.id, () => moveSectionDataChartAction(sectionId, c.id, "UP"))}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label={`Move ${c.caption} down`} disabled={i === charts.length - 1 || busyId === c.id} onClick={() => void run(c.id, () => moveSectionDataChartAction(sectionId, c.id, "DOWN"))}>↓</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => setRemoving(c)}>Remove</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly && <p className="mt-2 text-xs text-slate-500">This report is not open for changes. An approver can reopen it from the ⋯ menu (Reopen for changes).</p>}
      {!readOnly && sectionApproved && <p className="mt-2 text-xs text-slate-500">This section is approved. Adding or changing a chart reopens it, and it will need approving again.</p>}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.mode === "edit" ? "Edit chart" : "Add a chart from the Data Center"} size="lg">
        {sheetError && <p role="alert" className="mb-3 text-sm text-danger-700 dark:text-danger-300">{sheetError}</p>}
        {!sheet ? <p className="text-sm text-slate-500">{sheetError ? "" : "Loading the data…"}</p> : (
          <DataChartBuilder
            key={editing?.mode === "edit" ? editing.chart.id : "new"}
            sheet={sheet}
            stacked
            {...(editing?.mode === "edit" ? { initialSpec: editing.chart.spec as DataChartSpec } : {})}
            footer={({ spec, result }) => (
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-slate-500">
                  Caption (optional)
                  <Input className="mt-1" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="Leave empty to use the chart title" />
                </label>
                <div className="flex gap-2">
                  <Button disabled={!result.ok || saving} pending={saving} onClick={() => void save(spec)}>{editing?.mode === "edit" ? "Save chart" : "Add to section"}</Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            )}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this chart?"
        message={removing ? `“${removing.caption}” will be taken out of this section. The data it was drawn from is not affected.` : ""}
        confirmLabel="Remove chart"
        onConfirm={() => { const c = removing; setRemoving(null); if (c) void run(c.id, () => removeSectionDataChartAction(sectionId, c.id)); }}
      />
    </div>
  );
}
