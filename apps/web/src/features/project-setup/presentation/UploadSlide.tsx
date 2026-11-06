"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SETUP_MAX_DOCUMENTS } from "@donordesk/contracts";
import { startSetupAction } from "@/lib/actions/project-setup";
import { GuidancePanel } from "./GuidancePanel";
import { useSetupCopy } from "./useSetupCopy";

export interface RecentSetup {
  id: string;
  status: string;
  sourceName: string;
  updatedAt: string;
}

type Mode = "file" | "text" | "recent";

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size;

/** Step 1: add up to five documents by file or by pasting, or pick up a setup begun before. Sends them and moves to reading. */
export function UploadSlide({ recent }: { recent: RecentSetup[] }) {
  const { c, n } = useSetupCopy();
  const u = c.upload;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = mode === "file" ? files.length > 0 : text.trim().length > 0;

  const addFiles = (list: FileList | File[]) =>
    setFiles((current) => {
      const next = [...current];
      for (const file of Array.from(list)) if (next.length < SETUP_MAX_DOCUMENTS && !next.some((f) => sameFile(f, file))) next.push(file);
      return next;
    });

  function send() {
    setError(null);
    const form = new FormData();
    if (mode === "file") for (const file of files) form.append("file", file);
    else form.append("text", text);
    startTransition(async () => {
      const r = await startSetupAction(form);
      if (!r.ok) {
        setError(r.error.message || u.sendError);
        return;
      }
      router.push(`/projects/new/document/${encodeURIComponent(r.value.proposalId)}?s=reading`);
    });
  }

  const tabs: Array<[Mode, string]> = [["file", u.options[0]!.label], ["text", u.options[1]!.label], ["recent", u.options[2]!.label]];
  return (
    <>
      <div role="tablist" aria-label={u.tabsLabel} className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={mode === key} onClick={() => setMode(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${mode === key ? "bg-white text-brand-800 shadow dark:bg-slate-800 dark:text-brand-200" : "text-slate-600 dark:text-slate-300"}`}>{label}</button>
        ))}
      </div>

      {mode === "file" && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${over ? "border-brand-500 bg-brand-50 dark:bg-brand-400/10" : "border-slate-300 dark:border-white/15"}`}
          >
            <p aria-hidden="true" className="text-3xl">📄</p>
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{u.drop}</p>
            <input ref={input} id="setup-file" type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" className="sr-only"
              onChange={(e) => {
                // Copy the chosen files first: clearing the input empties its (live) list, and React reads it later.
                const chosen = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                addFiles(chosen);
              }} />
            <button type="button" className="btn-secondary mt-3" disabled={files.length >= SETUP_MAX_DOCUMENTS} onClick={() => input.current?.click()}>{files.length > 0 ? u.addFiles : u.chooseFiles}</button>
          </div>
          {files.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{u.filesOf(n(files.length), n(SETUP_MAX_DOCUMENTS))}</p>
              <ul className="mt-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/50">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                      {u.sizeKb(n(Math.max(1, Math.round(f.size / 1024))))}
                      <button type="button" aria-label={u.removeFile(f.name)} className="rounded px-1.5 text-base text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}>✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {mode === "text" && (
        <div>
          <label htmlFor="setup-text" className="label">{u.pasteLabel}</label>
          <textarea id="setup-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} className="input" />
        </div>
      )}
      {mode === "recent" && (
        <section aria-label={u.recentTitle}>
          {recent.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{u.noRecent}</p> : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/50">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link href={`/projects/new/document/${encodeURIComponent(r.id)}`} className="font-medium text-brand-700 underline dark:text-brand-300">{r.sourceName}</Link>
                  <span className="tag tag-slate">{u.recentStatus[r.status] ?? r.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {mode !== "recent" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn px-6" disabled={!ready || pending} onClick={send}>{pending ? u.busy : <>{u.button} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span></>}</button>
          {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        </div>
      )}

      <p className="flex gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200"><span aria-hidden="true">📁</span><span>{u.where}</span></p>
      <section aria-label={u.formatsTitle} className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/50">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{u.formatsTitle}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {u.formats.map((f) => (
            <li key={f.name} className="text-sm"><span className="font-medium text-slate-800 dark:text-slate-100">{f.name}.</span> <span className="text-slate-600 dark:text-slate-300">{f.note}</span></li>
          ))}
        </ul>
      </section>
      <GuidancePanel guide={{ checks: [], dos: u.dos, donts: u.donts, options: u.options, tip: u.tip }} />
    </>
  );
}
