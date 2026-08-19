"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { importActivitiesTextAction } from "@/lib/actions/activities";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { ImportActivitiesResponse } from "@/lib/server/schemas";

async function parseActivitiesFile(file: File): Promise<string> {
  const r = await parseFileAction("activities", file);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.text;
}

export function ImportActivitiesForm({
  projectId,
  reportingPeriods,
}: {
  projectId: string;
  reportingPeriods: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reportingPeriodId, setReportingPeriodId] = useState(reportingPeriods[0]?.id ?? "");
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportActivitiesResponse | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await parseActivitiesFile(file);
      setExtractedText(text);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  async function createActivities() {
    if (!extractedText || !reportingPeriodId) return;
    setImporting(true);
    setError(null);
    const r = await importActivitiesTextAction({
      projectId,
      reportingPeriodId,
      text: extractedText,
      sourceName: fileName ?? undefined,
    });
    setImporting(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setResult(r.value);
    if (r.value.created === 0) {
      setError("No new activities were created. Rows with titles that already exist in this project are skipped.");
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Import activities from Excel</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Upload an Excel, CSV, or text file with your activity updates. Rows with Activity Title, Activity Date, and Summary
        are auto-parsed and submitted for review.
      </p>

      <div className="card mt-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-4">
            <Field
              label="Reporting period"
              htmlFor="reportingPeriod"
              description="All imported activities are attached to this period."
            >
              <select
                id="reportingPeriod"
                value={reportingPeriodId}
                onChange={(e) => setReportingPeriodId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
              >
                {reportingPeriods.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Activities file"
              htmlFor="activitiesFile"
              description="Supported formats: XLSX, CSV, TXT. Output and indicator codes are matched against this project's logframe."
            >
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  id="activitiesFile"
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  pending={busy}
                  disabled={busy || importing}
                >
                  {busy ? "Parsing..." : "Upload Excel/CSV"}
                </Button>
                {fileName && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">{fileName}</span>
                )}
              </div>
            </Field>
          </div>
          <a className="btn-secondary text-xs" href="/api/templates/activities">Download template</a>
        </div>

        {extractedText && !result && (
          <Field
            label="Extracted content"
            htmlFor="extractedText"
            description="Review the parsed content before creating records."
          >
            <Textarea
              id="extractedText"
              className="min-h-[300px] font-mono text-xs"
              value={extractedText}
              readOnly
            />
          </Field>
        )}

        {result && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Created {result.created} activit{result.created === 1 ? "y" : "ies"}
              {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.warnings.map((w, idx) => (
                  <li key={idx} className="text-xs text-amber-600 dark:text-amber-400">{w}</li>
                ))}
              </ul>
            )}
            {result.items.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-white/10">
                {result.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1">{item.activityTitle}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{item.activityDate.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => router.push(`/projects/${projectId}/activities`)}>
                View activities
              </Button>
            </div>
          </div>
        )}

        {error && <InlineAlert tone="danger" title={error} />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          {extractedText && !result && (
            <Button pending={importing} disabled={importing} onClick={() => void createActivities()}>
              Create activity records
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
