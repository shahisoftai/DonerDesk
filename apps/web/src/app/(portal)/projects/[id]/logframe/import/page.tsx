"use client";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

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
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
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

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">Import logframe from Excel</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Upload an Excel or CSV file with your logframe structure. The file should have columns for Level, Code, Title, and Description.
      </p>

      <div className="card mt-6 space-y-4">
        <Field
          label="Logframe file"
          htmlFor="logframeFile"
          description="Supported formats: XLSX, CSV, TXT. Download a template for the expected format."
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
            description="Review the extracted content. Copy this to the logframe items creation form."
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
          <Button onClick={() => router.push(`/projects/${resolvedParams.id}/logframe/new`)}>
            Add items manually
          </Button>
        </div>
      </div>
    </div>
  );
}
