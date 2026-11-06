"use client";

import { useEffect, useState } from "react";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";

const KEY = "donordesk.plan-card-dismissed";

/**
 * The one optional card shown to a project with no planned activities. Dismissed per person ("Not now"); never a
 * setup blocker, a checklist item or a red badge. Storage can be blocked, so every access is guarded.
 */
export function PlanEmptyCard({ projectId, canPlan }: { projectId: string; canPlan: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(`${KEY}.${projectId}`) === "1"); } catch { /* storage unavailable: show the card */ }
  }, [projectId]);

  if (dismissed) return null;
  function dismiss() {
    setDismissed(true);
    try { window.localStorage.setItem(`${KEY}.${projectId}`, "1"); } catch { /* the card simply returns next visit */ }
  }

  return (
    <section aria-labelledby="plan-card-title" className="rounded-xl border border-slate-200 p-5 dark:border-white/10">
      <h2 id="plan-card-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">{WORKPLAN_COPY.emptyCardTitle}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{WORKPLAN_COPY.emptyCardBody}</p>
      {canPlan ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a className="btn" href={`/projects/${projectId}/activities/plan/start`}>{WORKPLAN_COPY.startFromLogframe}</a>
          <a className="btn-secondary" href={`/projects/${projectId}/activities/plan/new`}>{WORKPLAN_COPY.addPlanned}</a>
          <a className="btn-secondary" href={`/projects/${projectId}/activities/plan/import`}>{WORKPLAN_COPY.importSheet}</a>
          <button type="button" className="text-sm text-slate-500 underline" onClick={dismiss}>{WORKPLAN_COPY.notNow}</button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">A project manager can set up the plan.</p>
      )}
    </section>
  );
}
