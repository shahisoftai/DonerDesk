"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyEvidenceAction } from "@/lib/actions/evidence";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";

export function EvidenceVerificationPanel({
  evidenceId,
  verificationStatus,
  sensitive,
}: {
  evidenceId: string;
  verificationStatus: string;
  sensitive: boolean;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [confirming, setConfirming] = useState(false);

  if (verificationStatus === "VERIFIED") return null;

  async function verify() {
    const result = await actionState.run(() => verifyEvidenceAction(evidenceId));
    if (result !== undefined) {
      setConfirming(false);
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="verify-title" className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h2 id="verify-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">
        Verification
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Confirm this evidence is accurate and suitable for reporting. Verification is recorded in the audit trail.
        {sensitive && " This file is marked sensitive — verify access carefully."}
      </p>

      {!confirming ? (
        <Button size="sm" className="mt-3" onClick={() => setConfirming(true)}>
          Verify evidence
        </Button>
      ) : (
        <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Mark this evidence as verified? This cannot be undone without a correction request.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={verify} pending={actionState.busy}>
              Confirm verification
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {actionState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </section>
  );
}
