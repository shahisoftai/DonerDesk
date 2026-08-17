"use client";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

async function parseIndicatorsFile(file: File): Promise<string> {
  const r = await parseFileAction("indicators", file);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.text;
}

export default function ImportIndicatorsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await parseIndicatorsFile(file);
      setExtractedText(text);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">Import indicators from Excel</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Upload an Excel file with your indicators. The file should have columns for Code, Name, Type, Baseline, Target, and Unit.
      </p>

      <div className="card mt-6 space-y-4">
        <Field
          label="Indicators file"
          htmlFor="indicatorsFile"
          description="Supported formats: XLSX, CSV, TXT. Download a template for the expected format."
        >
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="indicatorsFile"
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
              disabled={busy}
            >
              {busy ? "Parsing..." : "Upload Excel/CSV"}
            </Button>
            {fileName && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{fileName}</span>
            )}
          </div>
        </Field>

        {extractedText && (
          <Field
            label="Extracted content"
            htmlFor="extractedText"
            description="Review the extracted content. Copy this to the indicator creation form."
          >
            <Textarea
              id="extractedText"
              className="min-h-[300px] font-mono text-xs"
              value={extractedText}
              readOnly
            />
          </Field>
        )}

        {error && <InlineAlert tone="danger" title={error} />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={() => router.push(`/projects/${resolvedParams.id}/logframe/new-indicator`)}>
            Add indicator manually
          </Button>
        </div>
      </div>
    </div>
  );
}
