"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DataChartSpec } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { addSectionDataChartAction, getDraftSectionChoicesAction, type DraftSectionChoices } from "@/lib/actions/data-charts";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATE_LABEL: Record<string, string> = {
  NOT_STARTED: "no draft yet",
  IN_PROGRESS: "in progress",
  EVIDENCE_COLLECTION: "collecting evidence",
  DRAFT_GENERATED: "draft",
  UNDER_REVIEW: "under review",
  APPROVED: "approved",
  SUBMITTED: "submitted",
  CLOSED: "closed",
};
/** Report states in which the report may still be a draft that accepts charts (the live check on the chosen report decides). */
const MAY_BE_DRAFT = new Set(["IN_PROGRESS", "EVIDENCE_COLLECTION", "DRAFT_GENERATED"]);

/** Why charts cannot be added to a report in this state, in words a person can act on. */
function lockedReason(status: string | null, version: number | null): string {
  const v = version ? ` (version ${version})` : "";
  if (status === "UNDER_REVIEW") return `This report${v} is under review, so its charts are locked. Charts can be added again once it is back in draft.`;
  return `This report${v} is ${status === "SUBMITTED" ? "submitted" : status === "EXPORTED" ? "exported" : "approved"}, so its content, charts included, is locked. To add a chart, open the report and choose Regenerate whole draft: that starts a new version and keeps this one in history.`;
}

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
  const latestOpen = [...sheet.periods].reverse().find((p) => MAY_BE_DRAFT.has(p.reportStatus ?? ""));
  const [periodId, setPeriodId] = useState(defaultPeriodId ?? latestOpen?.id ?? "");
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
  const anyOpenHint = latestOpen ? null : "None of this project's reports is a draft right now, so there is nowhere to add a chart yet. Charts can be added to a report while it is a draft.";
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
            {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}{p.reportStatus ? ` — ${STATE_LABEL[p.reportStatus] ?? p.reportStatus.toLowerCase()}` : ""}{p.reportStatus && !MAY_BE_DRAFT.has(p.reportStatus) ? " (locked)" : ""}</option>)}
          </Select>
        </label>
        <label className="text-xs text-slate-500">
          Section
          <Select className="mt-1" value={sectionId} disabled={!editable} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">{loading ? "Loading…" : !periodId ? "Choose a report first" : editable ? "Choose a section" : "Not available for this report"}</option>
            {(editable ? choices?.sections : [])?.map((s) => <option key={s.id} value={s.id}>{s.title}{s.approved ? " (approved)" : ""}</option>)}
          </Select>
        </label>
        {anyOpenHint && <p className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2" role="status">{anyOpenHint}</p>}
        {periodId && !loading && choices && !choices.draftId && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 sm:col-span-2" role="status">
            This report has no draft yet. <Link className="font-medium underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link> and generate it first.
          </p>
        )}
        {periodId && !loading && choices?.draftId && !editable && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 sm:col-span-2" role="status">
            {lockedReason(choices.draftStatus, choices.draftVersion)} <Link className="font-medium underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link>
          </p>
        )}
        <label className="text-xs text-slate-500 sm:col-span-2">
          Caption (optional)
          <Input className="mt-1" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="Leave empty to use the chart title" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button disabled={!sectionId || busy || Boolean(disabledReason)} pending={busy} onClick={() => void add()}>Add to section</Button>
        {disabledReason && <span className="text-xs text-slate-500">{disabledReason}</span>}
        {message && <span role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-danger-700 dark:text-danger-300"}`}>{message.text}</span>}
        {message?.tone === "ok" && periodId && <Link className="text-sm text-brand-600 hover:underline" href={`/projects/${projectId}/reports/${periodId}`}>Open the report</Link>}
      </div>
    </section>
  );
}
