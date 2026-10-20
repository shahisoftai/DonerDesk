"use client";

import { useRouter } from "next/navigation";
import { approveLogframeVersionAction } from "@/lib/actions/logframe-versions";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";

/** Signs the results framework off as it stands now. */
export function ApproveFrameworkButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  async function approve() {
    const done = await state.run(() => approveLogframeVersionAction(projectId));
    if (done) router.refresh();
  }
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" disabled={!hydrated || state.busy} onClick={() => void approve()}>Sign off the framework as it is now</Button>
      {state.error && <p role="alert" className="text-xs text-danger-600">{state.error}</p>}
    </div>
  );
}
