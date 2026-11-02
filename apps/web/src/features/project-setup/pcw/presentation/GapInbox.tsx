"use client";

import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { sentenceFor } from "../domain/pcw-view";

/** Everything still to answer across all ten slides; each line opens the slide that can fix it. */
export function GapInbox({ view, onOpen }: { view: SetupDraftView; onOpen: (slide: SlideKey) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const PCW_SLIDES = pcw.slides;
  return (
    <aside aria-label={PCW_COPY.inboxTitle} className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm dark:border-white/10 dark:bg-slate-900/60">
      <h2 className="font-semibold text-slate-900 dark:text-white">{PCW_COPY.inboxTitle} ({view.inbox.length})</h2>
      {view.inbox.length === 0 ? (
        <p role="status" className="mt-2 text-slate-600 dark:text-slate-300">{PCW_COPY.inboxEmpty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {view.inbox.map((gap) => (
            <li key={gap.key}>
              <button type="button" className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => onOpen(gap.slide)}>
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{PCW_SLIDES[gap.slide].label}</span>
                <span className="block text-slate-800 dark:text-slate-100">{sentenceFor(gap, pcw.sentences)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
