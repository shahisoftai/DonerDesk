"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { AiActivityPopup } from "@/components/feedback/AiActivityPopup";
import { cn } from "@/components/ui/cn";
import { REPORT_TYPE_LABEL } from "@/lib/labels";
import type { TemplateDetail } from "@/lib/server/schemas";
import {
  deleteTemplateAction,
  markTemplateReviewedAction,
  reextractTemplateAction,
  setTemplateLibraryAction,
  updateTemplateMetadataAction,
} from "@/lib/actions/templates";
import { SectionTreeEditor } from "./SectionTreeEditor";
import { RequirementsEditor } from "./RequirementsEditor";
import { SourcePanel } from "./SourcePanel";
import { VersionHistory } from "./VersionHistory";
import { BriefPreview } from "./BriefPreview";
import { ExtractionMethodBadge, TemplateStatusBadge } from "./TemplateStatusBadge";

const TABS = [
  { id: "sections", label: "Sections" },
  { id: "requirements", label: "Report requirements" },
  { id: "preview", label: "AI brief preview" },
  { id: "source", label: "Source" },
  { id: "versions", label: "Versions" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];

/** Mirrors the AI extractor's actual two passes (packages/infrastructure/.../toc-extractor.ts): outline first, then per-section guidance. */
const EXTRACTION_STEPS = [
  "Reading the document's headings and structure…",
  "Working out the report's outline — sections and sub-sections…",
  "Reading the donor's instructions for each section…",
  "Finding required tables, questions and word limits…",
  "Checking every extracted detail against the original text…",
  "Putting the template together…",
] as const;
// Real extractions have run 60-180s in practice; paces the simulated bar (no real % is available from the server).
const EXTRACTION_ESTIMATED_MS = 110_000;

export function TemplateWorkspace({
  projectId,
  template,
  logframeOptions,
}: {
  projectId: string;
  template: TemplateDetail;
  logframeOptions: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("sections");
  const [version, setVersion] = useState(template.version ?? 1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [meta, setMeta] = useState({ templateName: template.templateName, donorName: template.donorName, reportType: template.reportType, language: template.language ?? "en", notes: template.notes ?? "" });
  const extracting = template.status === "EXTRACTING";
  const warnings = template.extractionMeta?.warnings ?? [];
  const editorKey = `${template.extractionMeta?.extractedAt ?? "none"}-${template.status === "EXTRACTING"}`;

  useEffect(() => setVersion(template.version ?? 1), [template.version]);
  useEffect(() => {
    if (!extracting) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [extracting, router]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>, after?: () => void) {
    setBusy(label);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      setError(r.error?.message ?? "Something went wrong");
      return;
    }
    after?.();
    router.refresh();
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{template.templateName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>{template.donorName} · {REPORT_TYPE_LABEL[template.reportType] ?? template.reportType} · v{version}</span>
              <TemplateStatusBadge status={template.status} />
              <ExtractionMethodBadge method={template.extractionMeta?.method} />
              {template.extractionMeta?.model && <span className="text-xs">({template.extractionMeta.model})</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm" title="Library templates can be copied into other projects">
              <Switch
                checked={template.isLibrary}
                onCheckedChange={(v) => run("library", () => setTemplateLibraryAction(template.id, v))}
                disabled={busy !== null}
                label="Save to template library"
              />
              In library
            </label>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditingMeta((v) => !v)}>Edit details</Button>
            <Button
              type="button"
              size="sm"
              disabled={extracting || template.status === "REVIEWED" || busy !== null}
              pending={busy === "review"}
              onClick={() => run("review", () => markTemplateReviewedAction(template.id))}
            >
              {template.status === "REVIEWED" ? "Approved" : "Approve template"}
            </Button>
          </div>
        </div>

        {editingMeta && (
          <form
            className="card grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run("meta", () => updateTemplateMetadataAction(template.id, { ...meta, notes: meta.notes.trim() ? meta.notes : null }), () => setEditingMeta(false));
            }}
          >
            <Field label="Template name" htmlFor="meta-name"><Input id="meta-name" value={meta.templateName} onChange={(e) => setMeta({ ...meta, templateName: e.target.value })} required /></Field>
            <Field label="Donor" htmlFor="meta-donor"><Input id="meta-donor" value={meta.donorName} onChange={(e) => setMeta({ ...meta, donorName: e.target.value })} required /></Field>
            <Field label="Report type" htmlFor="meta-type">
              <Select id="meta-type" value={meta.reportType} onChange={(e) => setMeta({ ...meta, reportType: e.target.value })}>
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t}</option>)}
              </Select>
            </Field>
            <Field label="Language" htmlFor="meta-lang"><Input id="meta-lang" value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Notes" htmlFor="meta-notes"><Textarea id="meta-notes" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></Field></div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setEditingMeta(false)}>Cancel</Button>
              <Button type="submit" pending={busy === "meta"}>Save details</Button>
            </div>
          </form>
        )}

        {extracting && (
          <InlineAlert tone="ai" title="Analysing the template…">
            <span className="flex items-center gap-2"><Spinner /> Sections, instructions and requirements are being extracted. This page updates automatically.</span>
          </InlineAlert>
        )}
        <AiActivityPopup
          open={extracting}
          title="Analysing your template"
          steps={EXTRACTION_STEPS}
          estimatedMs={EXTRACTION_ESTIMATED_MS}
          note="This usually takes one to three minutes for a full donor template. You can leave this page open — it updates on its own."
          variant="overlay"
        />
        {template.status === "EXTRACTION_FAILED" && (
          <InlineAlert tone="danger" title="Extraction failed">
            {warnings[0] ?? "The template could not be analysed."} Correct the text under Source and extract again, or add sections manually.
          </InlineAlert>
        )}
        {template.status === "NEEDS_REVIEW" && (
          <InlineAlert tone={template.extractionMeta?.method === "CANONICAL" ? "danger" : "warning"} title="Review before use">
            Check every section against the donor&rsquo;s template, correct anything wrong, mark each section reviewed, save, then approve the template.
            Reports can only be generated from an approved template.
          </InlineAlert>
        )}
        {warnings.length > 0 && template.status !== "EXTRACTION_FAILED" && (
          <details className="text-sm text-slate-600 dark:text-slate-400">
            <summary className="cursor-pointer">{warnings.length} extraction note(s)</summary>
            <ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        )}
        {error && <InlineAlert tone="danger" title={error} />}
      </header>

      <nav aria-label="Template sections" className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-sm dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5",
              tab === t.id ? "bg-brand-500/10 font-medium text-brand-700 dark:bg-brand-400/10 dark:text-brand-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div hidden={tab !== "sections"}>
        <SectionTreeEditor key={`s-${editorKey}`} templateId={template.id} initialSections={template.sections} version={version} readOnly={extracting} logframeOptions={logframeOptions} onSaved={setVersion} />
      </div>
      <div hidden={tab !== "requirements"}>
        <RequirementsEditor key={`r-${editorKey}`} templateId={template.id} initial={template.requirements} version={version} readOnly={extracting} onSaved={setVersion} />
      </div>
      {tab === "preview" && <BriefPreview templateId={template.id} version={version} />}
      {tab === "source" && <SourcePanel templateId={template.id} originalFile={template.originalFile} rawText={template.extractedRawText} readOnly={extracting} />}
      {tab === "versions" && <VersionHistory templateId={template.id} versions={template.versions} />}

      <section className="card space-y-3">
        <h2 className="font-medium">More</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/projects/${projectId}/templates/${template.id}/mapping`} className="text-brand-600 hover:underline dark:text-brand-400">
            Map this donor&rsquo;s own DOCX layout →
          </Link>
          {template.hasExtractedText && (
            <Button type="button" size="sm" variant="secondary" disabled={extracting || busy !== null} pending={busy === "reextract"} onClick={() => run("reextract", () => reextractTemplateAction(template.id, { mode: "merge" }))}>
              Re-extract (keep reviewed)
            </Button>
          )}
          <Button type="button" size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>Delete template</Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => run("delete", () => deleteTemplateAction(template.id), () => router.push(`/projects/${projectId}/templates`))}
        title="Delete this template?"
        message="The template and its version history are removed. Reporting periods keep the copy they were generated with."
        confirmLabel="Delete template"
        pending={busy === "delete"}
      />
    </div>
  );
}
