"use client";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { importEvidenceTextAction } from "@/lib/actions/evidence";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { EVIDENCE_TYPE_LABEL } from "@/lib/labels";
import type { ImportEvidenceResponse } from "@/lib/server/schemas";

async function parseEvidenceFile(file: File): Promise<string> {
  const r = await parseFileAction("evidence", file);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.text;
}

export default function ImportEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportEvidenceResponse | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await parseEvidenceFile(file);
      setExtractedText(text);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  async function createEvidence() {
    if (!extractedText) return;
    setImporting(true);
    setError(null);
    const r = await importEvidenceTextAction({
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
      setError("No evidence records were created. Every row needs a valid Google Drive Web Link.");
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Import evidence from Excel</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Upload an Excel, CSV, or text file with your evidence metadata. Rows with Title, File Name, Evidence Type, and a
        Google Drive Web Link are auto-parsed into link-first evidence records.
      </p>

      <div className="card mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Field
            label="Evidence file"
            htmlFor="evidenceFile"
            description="Supported formats: XLSX, CSV, TXT. Each row needs a Drive Web Link."
          >
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                id="evidenceFile"
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
          <a className="btn-secondary text-xs" href="/api/templates/evidence">Download template</a>
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
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Created {result.created} evidence record{result.created === 1 ? "" : "s"}
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
                    <span className="min-w-0 flex-1">{item.title}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {EVIDENCE_TYPE_LABEL[item.evidenceType] ?? item.evidenceType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => router.push(`/projects/${resolvedParams.id}/evidence`)}>
                View evidence
              </Button>
            </div>
          </div>
        )}

        {error && <InlineAlert tone="danger" title={error} />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          {extractedText && !result && (
            <Button pending={importing} disabled={importing} onClick={() => void createEvidence()}>
              Create evidence records
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
