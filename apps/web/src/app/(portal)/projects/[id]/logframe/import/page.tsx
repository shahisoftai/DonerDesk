"use client";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { importLogframeTextAction } from "@/lib/actions/logframe";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import type { ImportLogframeResponse } from "@/lib/server/schemas";

async function parseLogframeFile(file: File): Promise<string> {
  const r = await parseFileAction("logframe", file);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.text;
}

export default function ImportLogframePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportLogframeResponse | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await parseLogframeFile(file);
      setExtractedText(text);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  async function createItems() {
    if (!extractedText) return;
    setImporting(true);
    setError(null);
    const r = await importLogframeTextAction({
      projectId: resolvedParams.id,
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
      setError("No new items were created. Existing codes are skipped; check the file for parseable rows.");
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Import logframe from Excel</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Upload an Excel, CSV, or text file with your logframe structure. Rows with Level, Code, Title, and Description are
        auto-parsed into logframe records.
      </p>

      <div className="card mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Field
            label="Logframe file"
            htmlFor="logframeFile"
            description="Supported formats: XLSX, CSV, TXT. Use the Logframe sheet of the template."
          >
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                id="logframeFile"
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
          <a className="btn-secondary text-xs" href="/api/templates/logframe">Download template</a>
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
              Created {result.created} logframe item{result.created === 1 ? "" : "s"}
              {result.skipped > 0 ? ` · ${result.skipped} skipped (already in this project)` : ""}
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
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {LOGFRAME_LEVEL_LABEL[item.level as keyof typeof LOGFRAME_LEVEL_LABEL] ?? item.level}
                    </span>
                    {item.code && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.code}</span>}
                    <span className="min-w-0 flex-1">{item.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => router.push(`/projects/${resolvedParams.id}/logframe`)}>
                View logframe
              </Button>
            </div>
          </div>
        )}

        {error && <InlineAlert tone="danger" title={error} />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          {extractedText && !result && (
            <Button pending={importing} disabled={importing} onClick={() => void createItems()}>
              Create logframe items
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
