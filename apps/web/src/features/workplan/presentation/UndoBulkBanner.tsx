"use client";

import { useRouter } from "next/navigation";
import { undoBulkPlanAction } from "@/lib/actions/workplan";
import type { BulkPlanResult } from "@/lib/server/schemas";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";

/**
 * Offered after a bulk change: "Changed N activities. Undo". Undo sends back the steps the server returned, so each activity returns
 * to its own earlier dates, lead or status. A change that cannot be reversed (starting an activity) has no steps and no banner.
 */
export function UndoBulkBanner({ projectId, applied, undo, onDone }: { projectId: string; applied: number; undo: BulkPlanResult["undo"]; onDone: () => void }) {
  const router = useRouter();
  const state = useActionState();

  async function undoNow() {
    const done = await state.run(() => undoBulkPlanAction(projectId, undo));
    if (done) { onDone(); router.refresh(); }
  }

  if (undo.length === 0) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
      <span>Changed {applied} {applied === 1 ? "activity" : "activities"}.{undo.length < applied ? ` ${undo.length} can be put back.` : ""}</span>
      <Button size="sm" variant="secondary" onClick={undoNow} pending={state.busy}>Undo</Button>
      <button type="button" className="text-xs underline" onClick={onDone}>Dismiss</button>
      {state.error && <span role="alert" className="text-danger-600">{state.error}</span>}
    </div>
  );
}
