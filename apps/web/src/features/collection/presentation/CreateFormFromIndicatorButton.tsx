"use client";

import { useRouter } from "next/navigation";
import { createFormFromIndicatorAction } from "@/lib/actions/collection";
import { Button } from "@/components/ui/Button";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";

/**
 * "Collect this with a form": drafts the usual questions for the indicator (date, how many, where) and opens the draft to review.
 * Staff then record each event and the totals are added up for them. A refusal (a rate, a calculated value) is shown in words.
 */
export function CreateFormFromIndicatorButton({ projectId, indicatorId }: { projectId: string; indicatorId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const state = useActionState();

  async function create() {
    const made = await state.run(() => createFormFromIndicatorAction(indicatorId));
    if (made) router.push(`/projects/${projectId}/forms/${made.id}`);
  }

  return (
    <div>
      <Button variant="secondary" onClick={() => void create()} pending={state.busy} disabled={!hydrated}>Collect this with a form</Button>
      <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">Staff record each event with its date and number; the total is worked out for you.</p>
      {state.error && <p role="alert" className="mt-1 max-w-xs text-xs text-danger-700 dark:text-danger-400">{state.error}</p>}
    </div>
  );
}
