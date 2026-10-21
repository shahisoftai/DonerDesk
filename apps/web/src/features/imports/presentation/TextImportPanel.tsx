"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { parseFileAction } from "@/lib/actions/parse";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/** What every bulk import reports back, whatever it imports. */
export interface ImportOutcome {
  created: number;
  skipped: number;
  warnings: string[];
  items: ReadonlyArray<unknown>;
}

export interface TextImportPanelProps<R extends ImportOutcome> {
  kind: "logframe" | "indicators" | "evidence" | "activities" | "work-plan";
  title: string;
  intro: string;
  /** Singular and plural nouns for the result line, e.g. ["indicator", "indicators"]. */
  noun: readonly [string, string];
  fileHelp: string;
  templateHref?: string;
  /** Placeholder showing the shape of a pasted list. */
  pastePlaceholder: string;
  /** Shown when the import ran but created nothing. */
  noneCreatedMessage: string;
  createLabel: string;
  viewHref: string;
  viewLabel: string;
  /** Imports the text (extra form fields are the caller's own state, closed over here). */
  runImport(text: string, sourceName?: string): Promise<Result<R, AppError>>;
  renderItem(item: R["items"][number]): ReactNode;
  /** Optional fields that belong to this import only (e.g. a fallback period). */
  children?: ReactNode;
}

/**
 * One import screen for every bulk import: bring the data as a file, paste it, or dictate it, check the text, create
 * the records, read what happened. The per-import parts (which action runs, how an item reads) are passed in.
 */
export function TextImportPanel<R extends ImportOutcome>(props: TextImportPanelProps<R>) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<R | null>(null);
  /** Set when the words were read from a scan by text recognition: the person is told to check them. */
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [plural, singular] = [props.noun[1], props.noun[0]];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setScanNote(null);
    const parsed = await parseFileAction(props.kind, file);
    setBusy(false);
    if (!parsed.ok) {
      setError(parsed.error.message);
      return;
    }
    setText(parsed.value.text);
    setFileName(file.name);
    const note = parsed.value.metadata?.ocrNote;
    setScanNote(typeof note === "string" ? note : null);
  }

  async function createRecords() {
    if (!text.trim()) return;
    setImporting(true);
    setError(null);
    const outcome = await props.runImport(text, fileName ?? undefined);
    setImporting(false);
    if (!outcome.ok) {
      setError(outcome.error.message);
      return;
    }
    setResult(outcome.value);
    if (outcome.value.created === 0) setError(props.noneCreatedMessage);
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{props.intro}</p>

      <div className="card mt-6 space-y-4">
        {props.children}

        <div className="flex items-start justify-between gap-4">
          <Field label="Upload a file" htmlFor={`${props.kind}File`} description={props.fileHelp}>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} id={`${props.kind}File`} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} className="hidden" />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} pending={busy} disabled={busy || importing}>
                {busy ? "Reading…" : "Upload Excel/CSV"}
              </Button>
              {fileName && <span className="text-sm text-slate-500 dark:text-slate-400">{fileName}</span>}
            </div>
          </Field>
          {props.templateHref && <a className="btn-secondary text-xs" href={props.templateHref}>Download template</a>}
        </div>

        {!result && scanNote && <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{scanNote}</p>}
        {!result && (
          <Field label="Or paste or dictate it here" htmlFor={`${props.kind}Text`} description="Edit anything before creating the records. A file you upload appears here too.">
            <Textarea
              dictate
              id={`${props.kind}Text`}
              className="min-h-[220px] font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={props.pastePlaceholder}
            />
          </Field>
        )}

        {result && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Created {result.created} {result.created === 1 ? singular : plural}
              {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400">{w}</li>
                ))}
              </ul>
            )}
            {result.items.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-white/10">
                {result.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5 text-sm">{props.renderItem(item as R["items"][number])}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => router.push(props.viewHref)}>{props.viewLabel}</Button>
            </div>
          </div>
        )}

        {error && <InlineAlert tone="danger" title={error} />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          {!result && (
            <Button pending={importing} disabled={importing || !text.trim()} onClick={() => void createRecords()}>
              {props.createLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
