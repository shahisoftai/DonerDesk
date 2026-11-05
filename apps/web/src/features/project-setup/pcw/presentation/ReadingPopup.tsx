"use client";

import { useEffect, useRef, useState } from "react";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { readingFileNames, readingProgress, type PartState } from "../domain/reading-progress";
import { usePcwCopy } from "./usePcwCopy";

/** One line per part: the state is the draft's own run state, shown as a symbol and always as a word too (never colour alone). */
function StateMark({ state }: { state: PartState }) {
  if (state === "DONE") {
    return <span aria-hidden className="pcw-check-pop grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>;
  }
  if (state === "READING") {
    return <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 motion-reduce:animate-none" />;
  }
  if (state === "FAILED") {
    return <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[11px] font-bold text-white">!</span>;
  }
  return <span aria-hidden className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />;
}

/**
 * Shown while the documents are being read, so the person knows what is happening and that nothing has been created. It is
 * informational, never a gate: it can be closed (button or Escape) and the page behind it stays usable. Progress comes only from
 * the draft's run states, so it never claims more than the server has done. Motion is off under reduced-motion.
 */
export function ReadingPopup({ view }: { view: SetupDraftView }) {
  const t = usePcwCopy().c.readingPopup;
  const [closed, setClosed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  const open = view.status === "EXTRACTING" && !closed;

  useEffect(() => {
    if (!open) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setClosed(true); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const progress = readingProgress(view.areaRuns);
  const names = readingFileNames(view.sources);
  const label: Record<PartState, string> = { WAITING: t.waiting, READING: t.reading, DONE: t.done, FAILED: t.failed };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]" data-testid="reading-popup">
      <div role="dialog" aria-modal="true" aria-labelledby="reading-title" className="pcw-pop-in w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div aria-hidden className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 border-brand-500 bg-white dark:bg-slate-800">
            <div className="space-y-1.5 p-2">
              {[72, 92, 60, 86, 52, 78].map((w, i) => <div key={i} style={{ width: `${w}%` }} className="h-1 rounded bg-slate-300 dark:bg-slate-600" />)}
            </div>
            <div className="pcw-scan absolute inset-x-0 h-0.5 bg-brand-500 shadow-[0_0_8px_2px_rgba(180,120,40,0.55)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="reading-title" className="text-lg font-semibold">{t.title}</h2>
              <span className="shrink-0 text-xs tabular-nums text-slate-500" aria-hidden>{t.seconds(seconds)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.lead}</p>
            {names.length > 0 ? (
              <p className="mt-2 truncate text-xs text-slate-500" title={names.join(", ")}>{t.files(view.sources.length)}: {names.join(", ")}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={t.progress(progress.done, progress.total)} className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="pcw-bar relative h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out" style={{ width: `${Math.max(progress.percent, 6)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">{t.progress(progress.done, progress.total)}</p>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-live="polite">
          {progress.parts.map(({ part, state }) => (
            <li key={part} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <StateMark state={state} />
              <span className="min-w-0 flex-1 truncate">{t.parts[part]}</span>
              <span className="text-xs text-slate-500">{label[state]}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-500">{t.privacy}</p>
        <div className="mt-4 flex justify-end">
          <button ref={close} type="button" className="btn-secondary" onClick={() => setClosed(true)}>{t.keepWorking}</button>
        </div>
      </div>
    </div>
  );
}
