"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { addPlanDependencyAction, removePlanDependencyAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import type { DependencyOption } from "../domain/dependency-view";

/**
 * "Comes after" on a planned activity (phase 28.1-A): what must finish first, and what waits for this one. Adding or removing
 * a link is one step each; the server refuses a loop, a duplicate or another project, and the message says why.
 */
export function DependencyEditor({ itemId, after, before, options, canEdit }: {
  itemId: string;
  after: Array<{ id: string; title: string; finished: boolean }>;
  before: Array<{ id: string; title: string }>;
  options: DependencyOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [pick, setPick] = useState("");

  async function add() {
    if (!pick) return;
    const done = await state.run(() => addPlanDependencyAction(pick, itemId));
    if (done === true) { setPick(""); router.refresh(); }
  }

  async function remove(predecessorId: string) {
    const done = await state.run(() => removePlanDependencyAction(predecessorId, itemId));
    if (done === true) router.refresh();
  }

  return (
    <section aria-labelledby="deps-title" className="space-y-2">
      <h2 id="deps-title" className="text-sm font-semibold">{WORKPLAN_COPY.comesAfter}</h2>
      {after.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{WORKPLAN_COPY.noDependencies}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {after.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.title}</span>
              <span className={a.finished ? "text-brand-700 dark:text-brand-300" : "text-amber-700 dark:text-amber-400"}>{a.finished ? "Finished" : "Not finished"}</span>
              {canEdit && (
                <button type="button" className="text-xs underline disabled:opacity-50" disabled={state.busy} onClick={() => remove(a.id)}>
                  {WORKPLAN_COPY.removeDependency}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {before.length > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{WORKPLAN_COPY.comesBefore}: {before.map((b) => b.title).join(", ")}</p>
      )}
      {canEdit && options.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="dep-pick" className="block text-sm font-medium">{WORKPLAN_COPY.addDependency}</label>
            <select id="dep-pick" value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-slate-900">
              <option value="">Choose an activity</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={add} pending={state.busy} disabled={!hydrated || !pick}>Add</Button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
