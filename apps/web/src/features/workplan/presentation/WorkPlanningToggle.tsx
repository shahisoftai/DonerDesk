"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { setWorkPlanningVisibilityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";

/** Admin-only project setting. It saves at once and says so; turning it off hides the screens and keeps the data. */
export function WorkPlanningToggle({ projectId, initial }: { projectId: string; initial: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [show, setShow] = useState(initial);

  async function change(next: boolean) {
    const done = await state.run(() => setWorkPlanningVisibilityAction(projectId, next));
    if (done === true) { setShow(next); router.refresh(); }
  }

  return (
    <section className="card mt-6 max-w-2xl" aria-labelledby="work-planning-title">
      <h3 id="work-planning-title" className="text-sm font-semibold">{WORKPLAN_COPY.showWorkPlanning}</h3>
      <p className="mt-1 text-xs text-slate-500">Turning this off hides planned activities for everyone on this project. Nothing is deleted, and it saves as soon as you change it.</p>
      <label className="mt-3 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={show} disabled={!hydrated || state.busy} onChange={(e) => change(e.target.checked)} />
        {WORKPLAN_COPY.showWorkPlanning}
      </label>
      {state.error && <p role="alert" className="mt-2 text-xs text-danger-600">{state.error}</p>}
    </section>
  );
}
