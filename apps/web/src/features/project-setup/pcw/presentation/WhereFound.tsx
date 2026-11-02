"use client";

import { useState, useTransition } from "react";
import { getSetupPassageAction } from "@/lib/actions/project-setup";
import type { SetupPassage } from "@/lib/server/schemas-project-setup";
import { highlightParts } from "../../domain/passage";
import { usePcwCopy } from "./usePcwCopy";

/** "Show in the document": opens the passage a quote was read from, with the quote marked in its place. */
export function WhereFound({ id, source, quote }: { id: string; source: { documentId: string; block: number }; quote: string }) {
  const t = usePcwCopy().c.parity;
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<SetupPassage | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const show = () => {
    setOpen(true);
    if (passage) return;
    setFailed(false);
    startTransition(async () => {
      const r = await getSetupPassageAction(id, source.documentId, source.block);
      if (r.ok) setPassage(r.value); else setFailed(true);
    });
  };
  return (
    <>
      <button type="button" className="text-xs font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300" onClick={show}>{t.showInDocument}</button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={t.showInDocument} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{passage ? (passage.sheet ? t.sheetOf(passage.documentName, passage.sheet) : passage.documentName) : t.showInDocument}</h3>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t.close}</button>
            </div>
            {pending ? <p className="mt-3 text-sm">{t.passageLoading}</p> : null}
            {failed ? <p role="alert" className="mt-3 text-sm text-danger-600">{t.passageFailed}</p> : null}
            {passage ? (
              <div className="mt-3 space-y-3 text-sm">
                {passage.before ? <div><p className="text-xs font-medium text-slate-500">{t.passageBefore}</p><p className="whitespace-pre-wrap text-slate-500">{passage.before}</p></div> : null}
                <p className="whitespace-pre-wrap">
                  {highlightParts(passage.text, quote).map((part, i) => (part.mark ? <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-500/40">{part.text}</mark> : <span key={i}>{part.text}</span>))}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
