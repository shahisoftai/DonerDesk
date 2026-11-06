"use client";

import { useState, useTransition } from "react";
import type { SlideKey } from "@donordesk/domain";
import { rerunSetupAreaAction } from "@/lib/actions/project-setup";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { AREAS_OF_SLIDE, areaState } from "../domain/parity-view";
import { usePcwCopy } from "./usePcwCopy";

/** "Read this part again": replaces this step's decisions with a fresh reading, after asking. Only offered when documents were read. */
export function RereadPart({ id, slide, view, onView }: { id: string; slide: SlideKey; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const t = usePcwCopy().c.parity;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const areas = AREAS_OF_SLIDE[slide] ?? [];
  if (view.sources.length === 0 || areas.length === 0) return null;
  const state = areaState(view, slide);
  const go = () => {
    setConfirming(false); setError(null);
    startTransition(async () => {
      for (const area of areas) {
        const r = await rerunSetupAreaAction(id, area);
        if (!r.ok) return setError(r.error.message);
      }
      const fresh = await getDraftAction(id);
      if (fresh.ok) onView(fresh.value);
    });
  };
  return (
    <div className="space-y-2 text-sm">
      {state === "RUNNING" ? <p role="status" className="text-xs">{t.rereadRunning}</p> : null}
      {state === "FAILED" ? <p role="alert" className="text-xs text-danger-600">{t.rereadFailed}</p> : null}
      {confirming ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p>{t.rereadWarn}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn" onClick={go}>{t.rereadConfirm}</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>{t.rereadKeep}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary" disabled={pending || state === "RUNNING"} onClick={() => setConfirming(true)}>{t.reread}</button>
      )}
      {error ? <p role="alert" className="text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}
