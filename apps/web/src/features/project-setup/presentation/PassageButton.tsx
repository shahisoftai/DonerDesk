"use client";

import { useState, useTransition } from "react";
import { getSetupPassageAction } from "@/lib/actions/project-setup";
import type { SetupPassage } from "@/lib/server/schemas-project-setup";
import { highlightParts } from "../domain/passage";
import { useSetupCopy } from "./useSetupCopy";

/** "Show in the document": opens the passage a quote was read from, with the quote marked in its place. */
export function PassageButton({ proposalId, sourceRef, quote }: { proposalId: string; sourceRef: { documentId: string; block: number }; quote: string }) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<SetupPassage | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const show = () => {
    setOpen(true);
    if (passage) return;
    setFailed(false);
    startTransition(async () => {
      const r = await getSetupPassageAction(proposalId, sourceRef.documentId, sourceRef.block);
      if (r.ok) setPassage(r.value);
      else setFailed(true);
    });
  };
  return (
    <>
      <button type="button" className="ms-2 text-xs font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300" onClick={show}>{rv.showInDocument}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={rv.showInDocument} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{passage ? rv.passageTitle(passage.documentName, passage.sheet) : rv.showInDocument}</h3>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{rv.close}</button>
            </div>
            {pending && <p className="mt-3 text-sm text-slate-600">{rv.passageLoading}</p>}
            {failed && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{rv.passageFailed}</p>}
            {passage && (
              <div className="mt-3 space-y-3 text-sm">
                {passage.before && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">{rv.passageBefore}</p>
                    <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">{passage.before}</p>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                  {highlightParts(passage.text, quote).map((part, i) => (part.mark ? <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-500/40">{part.text}</mark> : <span key={i}>{part.text}</span>))}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
