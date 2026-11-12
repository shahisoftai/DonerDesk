"use client";

import { useRouter } from "next/navigation";
import { approveLogframeVersionAction } from "@/lib/actions/logframe-versions";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** Signs the results framework off as it stands now. */
export function ApproveFrameworkButton({ projectId, pendingSummary }: { projectId: string; /** What has changed since the last sign-off, in words (results and measurement counted apart); empty when nothing is pending. */ pendingSummary?: string }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const { t } = useI18n();
  async function approve() {
    const done = await state.run(() => approveLogframeVersionAction(projectId));
    if (done) router.refresh();
  }
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" disabled={!hydrated || state.busy} onClick={() => void approve()}>Sign off the framework as it is now</Button>
      {pendingSummary ? <p className="text-xs text-slate-600 dark:text-slate-300">{t("framework.history.pending", { summary: pendingSummary })}</p> : null}
      {state.error && <p role="alert" className="text-xs text-danger-600">{state.error}</p>}
    </div>
  );
}
