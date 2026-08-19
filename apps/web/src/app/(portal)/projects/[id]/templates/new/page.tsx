"use client";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTemplateAction } from "@/lib/actions/templates";
import { parseFileAction } from "@/lib/actions/parse";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];
const IS_STUB = process.env.NODE_ENV !== "production";

async function parseTemplateFile(file: File): Promise<string> {
  const r = await parseFileAction("templates", file);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.text;
}

export default function NewTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [donorName, setDonorName] = useState("");
  const [reportType, setReportType] = useState("MONTHLY");
  const [language, setLanguage] = useState("en");
  const [extractedRawText, setExtractedRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const text = await parseTemplateFile(file);
      setExtractedRawText((prev) => (prev ? prev + "\n\n" + text : text));
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await createTemplateAction({
        projectId: resolvedParams.id,
        templateName,
        donorName,
        reportType,
        language,
        extractedRawText: extractedRawText || undefined,
      });
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      router.push(`/projects/${resolvedParams.id}/templates/${r.value.id}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Add donor template</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Paste the donor reporting instructions. We suggest sections for your review, which you can edit before saving.
      </p>
      {IS_STUB && (
        <div className="mt-4">
          <InlineAlert tone="ai" title="Extraction is a suggestion for review">
            Section suggestions are generated from the pasted text for you to review and edit. They are not source-verified
            and do not represent the donor&rsquo;s original formatting until you confirm them.
          </InlineAlert>
        </div>
      )}
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <Field label="Template name" htmlFor="templateName">
          <Input id="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Donor name" htmlFor="donorName">
            <Input id="donorName" value={donorName} onChange={(e) => setDonorName(e.target.value)} required />
          </Field>
          <Field label="Report type" htmlFor="reportType">
            <Select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t}</option>)}
            </Select>
          </Field>
        </div>
        <Field
          label="Template document"
          htmlFor="templateFile"
          description="Upload a DOCX or PDF file to extract text. You can also paste text directly below."
        >
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="templateFile"
              type="file"
              accept=".docx,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              pending={parsing}
              disabled={parsing}
            >
              {parsing ? "Parsing..." : "Upload DOCX/PDF"}
            </Button>
            {fileName && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {fileName}
              </span>
            )}
          </div>
        </Field>
        <Field
          label="Template text"
          htmlFor="extractedRawText"
          description="Extracted from uploaded file or paste text directly. Edit before submitting."
        >
          <Textarea
            id="extractedRawText"
            className="min-h-[200px]"
            value={extractedRawText}
            onChange={(e) => setExtractedRawText(e.target.value)}
            placeholder="Section 1. Executive Summary&#10;Section 2. Activities completed..."
          />
        </Field>
        {error && <InlineAlert tone="danger" title={error} />}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" pending={busy}>{busy ? "Reviewing..." : "Review sections"}</Button>
        </div>
      </form>
    </div>
  );
}
