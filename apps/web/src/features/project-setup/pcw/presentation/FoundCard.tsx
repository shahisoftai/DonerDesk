"use client";

import { useState, useTransition } from "react";
import type { SlideKey } from "@donordesk/domain";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { foundSummary, offersFound } from "../domain/found-summary";
import { usePcwCopy } from "./usePcwCopy";

/**
 * The first thing a person sees after documents were read: what was found in each area, one button to confirm everything that is
 * waiting, and one to go to the first step that still needs them. Confirming is the person's click; nothing is accepted before it.
 */
export function FoundCard({ id, view, onView, onOpen }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void; onOpen: (slide: SlideKey) => void }) {
  const c = usePcwCopy().c.simple.found;
  const summary = foundSummary(view);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!offersFound(view, summary)) return null;

  const confirmAll = () => start(async () => {
    for (const area of summary.areas) {
      if (area.waitingPaths.length === 0) continue;
      const r = await editSetupItemAction(id, { area: area.key, op: "ACCEPT_MANY", paths: area.waitingPaths });
      if (!r.ok) return setError(r.error.message);
    }
    const fresh = await getDraftAction(id);
    if (fresh.ok) { setError(null); onView(fresh.value); } else setError(fresh.error.message);
  });

  return (
    <section aria-labelledby="pcw-found" className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-900/20" data-testid="found-card">
      <h2 id="pcw-found" className="font-semibold">{c.title}</h2>
      <p className="text-sm text-slate-700 dark:text-slate-200">{c.lead}</p>
      <ul className="space-y-0.5 text-sm">{summary.areas.map((a) => <li key={a.key}>{c.line(c.areas[a.key] ?? a.key, a.found, a.waiting)}</li>)}</ul>
      <div className="flex flex-wrap gap-2">
        {summary.waiting > 0 ? <button type="button" className="btn" disabled={pending} onClick={confirmAll}>{c.confirmAll(summary.waiting)}</button> : <p role="status" className="text-sm">{c.allConfirmed}</p>}
        {summary.firstToReview ? <button type="button" className="btn-secondary" onClick={() => onOpen(summary.firstToReview!)}>{c.review}</button> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </section>
  );
}
