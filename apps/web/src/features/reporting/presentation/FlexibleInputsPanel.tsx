"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  previewPeriodValuesAction,
  confirmPeriodValuesAction,
  proposeFieldReportAction,
  applyFieldReportAction,
  type PeriodValuePreviewShape,
} from "@/lib/actions/reporting";

function csvToRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split(/[\t,]/).map((c) => c.trim()));
}

/**
 * Increment 5 — Flexible inputs. Two human-controlled entry points that feed
 * the existing structured model:
 *   ① Import indicator values (Excel/CSV paste → preview → confirm)
 *   ② Extract from field report (text → proposed inputs → review → confirm)
 * Nothing is written until the user confirms. Conservative: unmappable rows /
 * unconfirmed items are never silently guessed or dropped.
 */
export function FlexibleInputsPanel({
  projectId,
  periodId,
  onApplied,
}: {
  projectId: string;
  periodId: string;
  /** Called after values were written, so the page can refresh its data. */
  onApplied?: () => void;
}) {
  const [tab, setTab] = useState<"import" | "extract">("import");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PeriodValuePreviewShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [proposal, setProposal] = useState<{ indicatorAchievements: Array<{ indicatorCode: string; value: string }>; story: Array<{ field: string; text: string }> } | null>(null);

  const rows = useMemo(() => (csv ? csvToRows(csv) : []), [csv]);

  async function doPreview() {
    setBusy(true);
    setStatus(null);
    const r = await previewPeriodValuesAction(projectId, periodId, rows);
    setBusy(false);
    if (r.ok) { setPreview(r.value); setStatus(`${r.value.readyRows} ready, ${r.value.errorRows} need attention`); }
    else setStatus(r.error.message);
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    const items = preview.rows.filter((x) => x.status === "ready").map((x) => ({ indicatorCode: x.indicatorCode, periodAchievement: x.periodAchievement ?? "" }));
    const r = await confirmPeriodValuesAction(projectId, periodId, items);
    setBusy(false);
    if (r.ok) {
      setStatus(onApplied ? `Imported ${preview.readyRows} row(s).` : `Imported ${preview.readyRows} row(s). Reload to refresh indicators.`);
      setPreview(null);
      onApplied?.();
    } else setStatus(r.error.message);
  }

  async function doExtract() {
    setBusy(true);
    setStatus(null);
    const r = await proposeFieldReportAction(projectId, periodId, report);
    setBusy(false);
    if (r.ok) {
      setProposal({ indicatorAchievements: r.value.indicatorAchievements, story: r.value.story });
      setStatus(`Found ${r.value.indicatorAchievements.length} indicator value(s) and ${r.value.story.length} context note(s).`);
    } else setStatus(r.error.message);
  }

  async function doApply() {
    if (!proposal) return;
    setBusy(true);
    const r = await applyFieldReportAction(projectId, periodId, {
      indicatorAchievements: proposal.indicatorAchievements,
      story: Object.fromEntries(proposal.story.map((s) => [s.field, s.text])),
    });
    setBusy(false);
    if (r.ok) {
      setStatus(onApplied ? "Confirmed items saved." : "Confirmed items saved. Reload to refresh.");
      setProposal(null);
      onApplied?.();
    } else setStatus(r.error.message);
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Flexible inputs</h3>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => setTab("import")} className={`rounded px-2 py-1 ${tab === "import" ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300" : "text-slate-500"}`}>Import values</button>
          <button type="button" onClick={() => setTab("extract")} className={`rounded px-2 py-1 ${tab === "extract" ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300" : "text-slate-500"}`}>From field report</button>
        </div>
      </div>

      {tab === "import" ? (
        <div className="space-y-2">
          <Textarea rows={3} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Paste CSV:  Indicator code,Period achievement\n  OUT-1,30\n  OUT-2,4500"} />
          <Button size="sm" variant="secondary" onClick={doPreview} disabled={busy || rows.length === 0} pending={busy}>Preview</Button>
          {preview && (
            <div className="space-y-1 text-xs">
              {preview.rows.slice(0, 10).map((r) => (
                <div key={r.rowIndex} className={r.status === "ready" ? "text-slate-600 dark:text-slate-300" : "text-red-600"}>
                  <span className="font-medium">{r.indicatorCode || "(no code)"}</span> {r.periodAchievement ?? ""} · {r.status === "ready" ? (r.will === "update" ? "will update" : "will create") : r.error}
                </div>
              ))}
              {preview.rows.length > 10 && <div className="text-slate-400">… and {preview.rows.length - 10} more</div>}
              <Button size="sm" variant="secondary" onClick={doImport} disabled={busy || preview.readyRows === 0} pending={busy}>Import confirmed</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Paste a field report (DOCX/PDF text). We'll propose inputs you confirm." />
          <Button size="sm" variant="secondary" onClick={doExtract} disabled={busy || !report.trim()} pending={busy}>Extract</Button>
          {proposal && (
            <div className="space-y-1 text-xs">
              {proposal.indicatorAchievements.length > 0 && (
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-300">Proposed indicator values</p>
                  {proposal.indicatorAchievements.map((i) => (
                    <div key={i.indicatorCode} className="text-slate-600 dark:text-slate-300">{i.indicatorCode} = {i.value}</div>
                  ))}
                </div>
              )}
              {proposal.story.length > 0 && (
                <div>
                  <p className="font-medium text-slate-600 dark:text-slate-300">Proposed context</p>
                  {proposal.story.map((s, i) => (
                    <div key={i} className="text-slate-600 dark:text-slate-300">[{s.field}] {s.text}</div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={doApply} disabled={busy} pending={busy}>Add confirmed to report</Button>
            </div>
          )}
        </div>
      )}

      {status && <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>}
    </section>
  );
}
