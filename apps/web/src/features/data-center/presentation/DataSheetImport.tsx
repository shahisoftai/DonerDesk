"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importDataSheetAction } from "@/lib/actions/data-center";
import type { DataSheetImportResponse } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function DataSheetImport({ projectId }: { projectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DataSheetImportResponse["preview"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function reset(): void {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  }

  async function run(apply: boolean): Promise<void> {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const result = await importDataSheetAction(projectId, file, apply);
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error.message });
      return;
    }
    if (!apply) {
      setPreview(result.value.preview);
      return;
    }
    setMessage({ tone: "ok", text: result.value.saved === 0 ? "Nothing needed saving." : `Saved ${result.value.saved} ${result.value.saved === 1 ? "value" : "values"}. New values start as drafts and still need verification.` });
    reset();
    router.refresh();
  }

  const rows = preview?.rows.filter((r) => r.status !== "UNCHANGED").slice(0, 200) ?? [];
  const canApply = preview !== null && preview.missingColumns.length === 0 && preview.errors === 0 && preview.changed > 0;

  return (
    <section className="card" aria-labelledby="import-heading">
      <h3 id="import-heading" className="font-medium">Import a data sheet</h3>
      <p className="mt-1 text-sm text-slate-500">
        Download the Excel file, change the shaded columns (period value, cumulative value, data source, comments) and upload it here (.xlsx or .csv).
        Rows are matched on indicator code and period. An empty cell leaves the stored value as it is, and a verified value is never overwritten. You see what will change before anything is saved.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,.xlsx" aria-label="Data sheet file" className="text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMessage(null); }} />
        <Button size="md" variant="secondary" disabled={!file || busy} pending={busy && !preview} onClick={() => void run(false)}>Check file</Button>
        {canApply && <Button size="md" disabled={busy} pending={busy} onClick={() => void run(true)}>Save {preview.changed} {preview.changed === 1 ? "change" : "changes"}</Button>}
      </div>
      {message && <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-danger-700 dark:text-danger-300"}`}>{message.text}</p>}

      {preview && (
        <div className="mt-4">
          {preview.missingColumns.length > 0 ? (
            <p className="text-sm text-danger-700 dark:text-danger-300">The file is missing: {preview.missingColumns.join(", ")}. Start from the downloaded Excel file.</p>
          ) : (
            <>
              <p className="text-sm">
                <strong>{preview.changed}</strong> to change · <strong>{preview.unchanged}</strong> already the same · <strong>{preview.skipped}</strong> verified (left as they are) · <strong className={preview.errors > 0 ? "text-danger-700 dark:text-danger-300" : ""}>{preview.errors}</strong> with problems
              </p>
              {preview.errors > 0 && <p className="mt-1 text-xs text-slate-500">Fix or delete the rows with problems in your file, then check it again. Nothing is saved while any row has a problem.</p>}
              {rows.length > 0 && (
                <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                      <tr><th className={th}>Row</th><th className={th}>Indicator</th><th className={th}>Period</th><th className={th}>Period value</th><th className={th}>Cumulative</th><th className={th}>Result</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {rows.map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="px-3 py-1.5 tabular-nums">{r.rowNumber}</td>
                          <td className="px-3 py-1.5 font-mono text-xs">{r.indicatorCode}</td>
                          <td className="px-3 py-1.5">{r.periodLabel}</td>
                          <td className="px-3 py-1.5 tabular-nums">{r.status === "ERROR" ? "" : r.status === "SKIPPED" ? r.previousPeriodValue || "—" : `${r.previousPeriodValue || "—"} → ${r.periodValue || "—"}`}</td>
                          <td className="px-3 py-1.5 tabular-nums">{r.status === "ERROR" ? "" : r.status === "SKIPPED" ? r.previousCumulativeValue || "—" : `${r.previousCumulativeValue || "—"} → ${r.cumulativeValue || "—"}`}</td>
                          <td className="px-3 py-1.5">{r.status === "ERROR" ? <Badge tone="danger" title={r.error}>{r.error}</Badge> : r.status === "SKIPPED" ? <Badge tone="warning" title={r.error}>Verified: left as it is</Badge> : <Badge tone="info">Will change</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
