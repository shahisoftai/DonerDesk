"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelReportingPeriodAction, convertPeriodToFinalAction, restoreReportingPeriodAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";

export type PeriodLifecycleOffer = "cancel" | "convert" | "restore";

const COPY: Record<PeriodLifecycleOffer, { label: string; pending: string; confirm?: string }> = {
  cancel: { label: "Cancel period", pending: "Cancelling…", confirm: "Cancel this period? Its data stays and you can restore it later. It will no longer count in the calendar or the closing report." },
  convert: { label: "Make this the final report", pending: "Converting…", confirm: "Make this the final report? It becomes the closing report of the project: it states progress since the start." },
  restore: { label: "Restore period", pending: "Restoring…" },
};

/**
 * The actions a period offers beyond its workspace. What is offered is decided on the server page from the same rules
 * the handlers enforce; the server still refuses anything not allowed and its reason is shown here, in plain words.
 */
export function PeriodLifecycleActions({ periodId, offers }: { periodId: string; offers: PeriodLifecycleOffer[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PeriodLifecycleOffer | null>(null);
  const [confirming, setConfirming] = useState<PeriodLifecycleOffer | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(offer: PeriodLifecycleOffer) {
    if (pending) return;
    setPending(offer);
    setError(null);
    const result =
      offer === "cancel" ? await cancelReportingPeriodAction(periodId, reason)
      : offer === "convert" ? await convertPeriodToFinalAction(periodId)
      : await restoreReportingPeriodAction(periodId);
    setPending(null);
    if (!result.ok) return setError(result.error.message);
    setConfirming(null);
    setReason("");
    router.refresh();
  }

  if (offers.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
      <div className="flex flex-wrap gap-2">
        {offers.map((offer) => (
          <Button
            key={offer}
            size="sm"
            variant="secondary"
            pending={pending === offer}
            onClick={() => (COPY[offer].confirm ? setConfirming(confirming === offer ? null : offer) : void run(offer))}
          >
            {pending === offer ? COPY[offer].pending : COPY[offer].label}
          </Button>
        ))}
      </div>
      {confirming && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10" role="group" aria-label={COPY[confirming].label}>
          <p>{COPY[confirming].confirm}</p>
          {confirming === "cancel" && (
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              Reason (optional)
              <input className="input mt-1 w-full" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" pending={pending === confirming} onClick={() => void run(confirming)}>
              {COPY[confirming].label}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
