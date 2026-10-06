"use client";

import { useActionState } from "@/lib/client/action-state";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplateAction, parseTemplateFileAction, type ParsedTemplateFile } from "@/lib/actions/templates";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { FileDropzone } from "@/components/editor/FileDropzone";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];
const ACCEPT = ".docx,.pdf,.txt,.md,.xlsx,.csv";
type Mode = "upload" | "paste" | "manual";

export default function NewTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upload");
  const [templateName, setTemplateName] = useState("");
  const [donorName, setDonorName] = useState("");
  const [reportType, setReportType] = useState("QUARTERLY");
  const [language, setLanguage] = useState("en");
  const [text, setText] = useState("");
  const [file, setFile] = useState<ParsedTemplateFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useActionState();
  const [parsing, setParsing] = useState(false);

  async function onFiles(files: File[]) {
    const picked = files[0];
    if (!picked) return;
    setParsing(true);
    setError(null);
    const form = new FormData();
    form.set("file", picked);
    const r = await parseTemplateFileAction(form);
    setParsing(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setFile(r.value);
    setText(r.value.text);
    if (!templateName) setTemplateName(picked.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode !== "manual" && !text.trim()) {
      setError(mode === "upload" ? "Upload the donor's template file first." : "Paste the donor's template text first.");
      return;
    }
    // One key for this form: a double click or a repeat after a timeout never creates the template twice.
    const created = await save.runCreate((idempotencyKey) =>
      createTemplateAction(
        {
          projectId,
          templateName,
          donorName,
          reportType,
          language,
          extractedRawText: mode === "manual" ? undefined : text,
          originalFileKey: mode === "upload" && file ? file.fileKey : undefined,
          sections: mode === "manual" ? [{ title: "Executive Summary", inputType: "NARRATIVE" }] : [],
        },
        { idempotencyKey },
      ),
    );
    if (!created) return;
    router.push(`/projects/${projectId}/templates/${created.id}`);
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Add donor template</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Upload the donor&rsquo;s reporting template. DonorDesk extracts its sections, the donor&rsquo;s instructions and questions for each section,
        required tables, annexes and submission rules. You review and approve everything before it is used to write reports.
      </p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template name" htmlFor="templateName">
            <Input id="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required maxLength={200} />
          </Field>
          <Field label="Donor" htmlFor="donorName">
            <Input id="donorName" value={donorName} onChange={(e) => setDonorName(e.target.value)} required maxLength={200} />
          </Field>
          <Field label="Report type" htmlFor="reportType">
            <Select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t}</option>)}
            </Select>
          </Field>
          <Field label="Template language" htmlFor="language">
            <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} minLength={2} maxLength={10} />
          </Field>
        </div>

        <RadioGroup
          name="mode"
          label="How do you want to add it?"
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { value: "upload", label: "Upload the template file" },
            { value: "paste", label: "Paste the template text" },
            { value: "manual", label: "Build the sections myself" },
          ]}
        />

        {mode === "upload" && (
          <div className="space-y-2">
            <FileDropzone onFiles={onFiles} accept={ACCEPT} label={parsing ? "Reading file…" : "Drop the donor template here or choose a file"} hint="Word, PDF, text, Markdown, Excel or CSV, up to 20 MB. The original is kept with the template. Word keeps headings and tables best; scanned PDFs need the text pasted instead." />
            {file && (
              <InlineAlert tone="success" title={`Read ${file.fileName}`}>
                {file.headingCount} heading(s), {file.tableCount} table(s){file.pageCount ? `, ${file.pageCount} page(s)` : ""}. Check the text below, then continue.
              </InlineAlert>
            )}
          </div>
        )}
        {mode !== "manual" && (mode === "paste" || file) && (
          <Field label="Template text" htmlFor="templateText" description="Extraction works from this text (and the file's layout when uploaded). You can correct it first.">
            <Textarea id="templateText" className="min-h-[220px] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"1. Executive Summary\nProvide an overview of…\n2. Results\nDescribe progress against each outcome…"} />
          </Field>
        )}
        {mode === "manual" && (
          <InlineAlert tone="info" title="You will add sections on the next screen">
            A first section is created for you; add the donor&rsquo;s sections, instructions and questions, then approve the template.
          </InlineAlert>
        )}

        {(error ?? save.error) && <InlineAlert tone="danger" title={(error ?? save.error) as string} />}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" pending={save.busy} disabled={save.busy || parsing}>{save.waiting ? "Still saving…" : mode === "manual" ? "Create template" : "Extract and review"}</Button>
        </div>
      </form>
    </div>
  );
}
