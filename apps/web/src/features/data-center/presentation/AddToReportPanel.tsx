"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DataChartSpec } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { addSectionDataChartAction, getDraftSectionChoicesAction, type DraftSectionChoices } from "@/lib/actions/data-charts";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/**
 * "Add this chart to a report": the report (a reporting period of the project), the section and a caption. A report that has no
 * draft yet, or is no longer a draft, says so instead of offering sections.
 */
export function AddToReportPanel({ projectId, sheet, spec, canAdd, disabledReason, defaultPeriodId, onAdded }: {
  projectId: string;
  sheet: DataSheetResponse;
  spec: DataChartSpec;
  canAdd: boolean;
  /** Why the chart cannot be added right now (it cannot be drawn). */
  disabledReason?: string;
  defaultPeriodId?: string;
  onAdded?: (sectionId: string) => void;
}) {
  const [periodId, setPeriodId] = useState(defaultPeriodId ?? "");
  const [choices, setChoices] = useState<DraftSectionChoices | null>(null);
  const [loading, setLoading] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!periodId) { setChoices(null); return; }
    let cancelled = false;
    setLoading(true);
    setSectionId("");
    setMessage(null);
    void getDraftSectionChoicesAction(periodId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) { setChoices(null); setMessage({ tone: "error", text: r.error.message }); return; }
      setChoices(r.value);
    });
    return () => { cancelled = true; };
  }, [periodId]);

  if (!canAdd) return null;
  const editable = choices?.draftId && choices.draftStatus === "DRAFT";

  async function add(): Promise<void> {
    if (!sectionId) return;
    setBusy(true);
    setMessage(null);
    const r = await addSectionDataChartAction(sectionId, { spec, ...(caption.trim() ? { caption: caption.trim() } : {}) });
    setBusy(false);
    if (!r.ok) { setMessage({ tone: "error", text: r.error.message }); return; }
    const approved = choices?.sections.find((s) => s.id === sectionId)?.approved;
    setMessage({ tone: "ok", text: approved ? "Chart added. The section was approved, so it is open for review again." : "Chart added to the section." });
    setCaption("");
    onAdded?.(sectionId);
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-white/10" aria-label="Add this chart to a report">
      <h4 className="text-sm font-medium">Add this chart to a report</h4>
      <p className="mt-1 text-xs text-slate-500">The chart is saved in the section with the data it shows now. If the data changes later, the section offers an Update button; nothing changes by itself.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          Report
          <Select className="mt-1" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">Choose a report</option>
            {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </label>
        <label className="text-xs text-slate-500">
          Section
          <Select className="mt-1" value={sectionId} disabled={!editable} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">{loading ? "Loading…" : "Choose a section"}</option>
            {(editable ? choices?.sections : [])?.map((s) => <option key={s.id} value={s.id}>{s.title}{s.approved ? " (approved)" : ""}</option>)}
          </Select>
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Caption (optional)
          <Input className="mt-1" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="Leave empty to use the chart title" />
        </label>
      </div>
      {periodId && !loading && choices && !choices.draftId && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">This report has no draft yet. <Link className="text-brand-600 hover:underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link> and generate it first.</p>
      )}
      {periodId && !loading && choices?.draftId && !editable && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">This report is no longer a draft, so charts cannot be added to it.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button disabled={!sectionId || busy || Boolean(disabledReason)} pending={busy} onClick={() => void add()}>Add to section</Button>
        {disabledReason && <span className="text-xs text-slate-500">{disabledReason}</span>}
        {message && <span role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-danger-700 dark:text-danger-300"}`}>{message.text}</span>}
        {message?.tone === "ok" && periodId && <Link className="text-sm text-brand-600 hover:underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link>}
      </div>
    </section>
  );
}
