"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkResolveReportClaimsAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

type Resolution = "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";

/**
 * Applies one Accept-with-note/Exclude decision + one shared note to every
 * selected claim in a single call, mirroring BulkChecklistResolution so a
 * report with many failed statements doesn't require resolving each one
 * individually.
 */
export function BulkClaimResolution({
  claimIds,
  canOverrideConfidential,
  onDone,
}: {
  claimIds: string[];
  canOverrideConfidential: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    if (!resolution) return;
    const result = await actionState.run(() =>
      bulkResolveReportClaimsAction({ claimIds, resolution, notes: notes.trim() || undefined }),
    );
    if (result !== undefined) {
      setResolution(null);
      setNotes("");
      setConfirming(false);
      onDone();
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {claimIds.length} statement{claimIds.length === 1 ? "" : "s"} selected
      </p>
      {!resolution ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setResolution("ACCEPTED_WITH_LIMITATION")}>Accept all with note</Button>
          <Button size="sm" variant="secondary" onClick={() => setResolution("EXCLUDED")}>Exclude all</Button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {resolution === "ACCEPTED_WITH_LIMITATION"
              ? "Accept every selected statement with a written limitation. Each stays in the report, flagged as approved-with-caveat."
              : canOverrideConfidential
                ? "Exclude every selected statement from the report. You have the authority required for confidential sources."
                : "Exclude every selected statement from the report."}
          </p>
          <Field
            label="Note"
            htmlFor="bulk-claim-note"
            description="Shared note applied to every selected statement."
          >
            <Textarea
              id="bulk-claim-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </Field>
          {!confirming ? (
            <Button
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={resolution === "ACCEPTED_WITH_LIMITATION" && notes.trim().length === 0}
            >
              Continue
            </Button>
          ) : (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {resolution === "ACCEPTED_WITH_LIMITATION" ? "Accept" : "Exclude"} all {claimIds.length} selected statement(s)?
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={submit} pending={actionState.busy}>Confirm</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {actionState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </div>
  );
}
