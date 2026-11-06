"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IMPORT_OPTIONS, suggestImports } from "../domain/import-guide";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/data/Badge";

const TEXT_FILE = /\.(csv|tsv|txt)$/i;

/**
 * One place to start any import. Paste the first lines of a table or open a CSV/TSV, and the screens that could read it are
 * suggested, with the header words that matched. It only points: each import still checks every row itself.
 */
export function ImportGuide({ projectId }: { projectId: string }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const suggestions = useMemo(() => suggestImports(text, projectId), [text, projectId]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!TEXT_FILE.test(file.name)) {
      setNote("This kind of file is read by the screen itself. Choose what it contains from the list below.");
      return;
    }
    setNote(null);
    // Only the start of the file is needed to see its header.
    setText((await file.slice(0, 4000).text()).trim());
  }

  return (
    <div className="space-y-6">
      <section className="card max-w-3xl space-y-3" aria-labelledby="guide-title">
        <h3 id="guide-title" className="text-sm font-semibold">Not sure which one? Show us the top of your file</h3>
        <label className="block text-sm">
          <span className="label">Open a CSV or text file</span>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx" className="mt-1 block text-sm" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <Field label="Or paste the first few rows">
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Code\tIndicator\tBaseline\tTarget"} />
        </Field>
        {note && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{note}</p>}
        {text.trim() !== "" && (
          <div role="status" aria-live="polite">
            {suggestions.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">We could not tell from the first line. Choose what the file contains from the list below.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.slice(0, 3).map((s) => (
                  <li key={s.kind} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={s.confidence === "LIKELY" ? "success" : "neutral"}>{s.confidence === "LIKELY" ? "Likely" : "Possible"}</Badge>
                    <Link className="font-medium underline" href={s.href}>{s.title}</Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">because of: {s.because.join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="all-title">
        <h3 id="all-title" className="text-sm font-semibold">Or choose what you are bringing in</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {IMPORT_OPTIONS.map((o) => (
            <li key={o.kind} className="card">
              <Link className="font-medium underline" href={o.href(projectId)}>{o.title}</Link>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{o.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
