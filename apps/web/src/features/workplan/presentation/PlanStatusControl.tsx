"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canApplyPlanAction, planActionFor, PLAN_STATUS_LABEL, WORKPLAN_COPY, type PlanStatus } from "@donordesk/domain/contexts/workplan/index.js";
import { changePlanStatusAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { guardNetwork, isOfflineFailure } from "@/lib/shared/connectivity";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import type { AppError } from "@/lib/shared/app-error";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { planStatusEntry } from "@/features/offline/domain/plan-status-outbox";
import { Button } from "@/components/ui/Button";

const STEPS: ReadonlyArray<PlanStatus> = ["PLANNED", "IN_PROGRESS", "DONE"];

/**
 * The three-step control (Not started · Under way · Done). Which steps are offered comes from the same table the
 * server enforces (`canApplyPlanAction`), so a step that would be refused is not a button. Cancel and Restore live in the menu.
 */
export function PlanStatusControl({ itemId, status, suggested, canChange, queueOffline }: {
  itemId: string;
  status: PlanStatus;
  suggested?: "IN_PROGRESS" | "DONE";
  canChange: boolean;
  /** Where set (My week), a change made without a connection is kept on this device and sent when it returns. */
  queueOffline?: { title: string };
}) {
  const router = useRouter();
  const state = useActionState();
  const outbox = useOutbox();
  const [queued, setQueued] = useState(false);

  async function apply(to: PlanStatus) {
    const action = planActionFor(status, to);
    if (!action) return;
    let offline: AppError | undefined;
    // A "Done" is dated to the day it was made, so one that waits offline and is sent later is not counted as finishing late.
    const completedOn = action === "COMPLETE" ? new Date().toISOString().slice(0, 10) : undefined;
    const done = await state.run(async () => {
      const attempt = await guardNetwork(() => changePlanStatusAction(itemId, { action, ...(completedOn ? { completedOn } : {}) }));
      if (!attempt.ok && isOfflineFailure(attempt.error)) offline = attempt.error;
      return attempt;
    });
    if (done === true) { setQueued(false); router.refresh(); return; }
    if (offline && queueOffline && outbox.supported) {
      await outbox.enqueue(planStatusEntry({ id: newIdempotencyKey(), title: queueOffline.title, payload: { itemId, action, ...(completedOn ? { completedOn } : {}) }, now: Date.now() }));
      setQueued(true);
    }
  }

  if (status === "CANCELLED") return <span className="text-xs text-slate-500">{PLAN_STATUS_LABEL.CANCELLED}</span>;
  if (!canChange) return <span className="text-xs text-slate-600 dark:text-slate-300">{PLAN_STATUS_LABEL[status]}</span>;

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label="Status" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
        {STEPS.map((step) => {
          const current = step === status;
          const reachable = current || planActionFor(status, step) !== undefined;
          return (
            <button
              key={step}
              type="button"
              aria-pressed={current}
              disabled={!reachable || state.busy}
              onClick={() => (current ? undefined : apply(step))}
              className={`min-h-[32px] px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${current ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-200"}`}
            >
              {PLAN_STATUS_LABEL[step]}
            </button>
          );
        })}
      </div>
      {suggested && canApplyPlanAction(status, suggested === "DONE" ? "COMPLETE" : "START") && (
        <Button size="sm" variant="secondary" pending={state.busy} onClick={() => apply(suggested === "DONE" ? "DONE" : "IN_PROGRESS")}>
          {suggested === "DONE" ? WORKPLAN_COPY.markDoneQuestion : `Mark ${PLAN_STATUS_LABEL.IN_PROGRESS.toLowerCase()}?`}
        </Button>
      )}
      {queued && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">Saved on this device. It will be sent when you are back online.</p>}
      {state.error && !queued && <p role="alert" className="text-xs text-danger-600">{state.error}</p>}
    </div>
  );
}
