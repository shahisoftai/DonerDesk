"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SETUP_MAX_DOCUMENTS } from "@donordesk/contracts";
import { startSetupAction } from "@/lib/actions/project-setup";
import { usePcwCopy } from "./usePcwCopy";
import { addFiles } from "../domain/documents-view";

/**
 * Optional: documents are read for you and the slides then show what was found. Starting this makes a new draft (the documents
 * need their own), so it is offered before anything has been typed. Without the AI service or Google Drive, the sentence the
 * server gives says what is missing, and the slides below still work by hand.
 */
export function StartDocuments() {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.documents;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    setError(null);
    const form = new FormData();
    for (const f of files) form.append("file", f);
    startTransition(async () => {
      const r = await startSetupAction(form);
      if (!r.ok) return setError(r.error.message);
      router.push(`/projects/new/wizard?id=${encodeURIComponent(r.value.proposalId)}`);
    });
  };

  return (
    <section aria-labelledby="pcw-docs" className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h2 id="pcw-docs" className="text-lg font-semibold">{c.title}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{c.help}</p>
      <input
        ref={input} id="pcw-file" type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" className="sr-only"
        onChange={(e) => {
          // Copy the chosen files first: clearing the input empties its (live) list.
          const chosen = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          setFiles((cur) => addFiles(cur, chosen, SETUP_MAX_DOCUMENTS));
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={files.length >= SETUP_MAX_DOCUMENTS} onClick={() => input.current?.click()}>{c.choose}</button>
        {files.length > 0 ? <span className="text-sm">{c.filesOf(files.length, SETUP_MAX_DOCUMENTS)}</span> : null}
      </div>
      {files.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm dark:divide-white/10 dark:border-white/10">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">{f.name}</span>
              <button type="button" className="btn-secondary" aria-label={`${c.remove} ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}>{c.remove}</button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn" disabled={pending || files.length === 0} onClick={send}>{pending ? c.sending : c.read}</button>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </section>
  );
}
