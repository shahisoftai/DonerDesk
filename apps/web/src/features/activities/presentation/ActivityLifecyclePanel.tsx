"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreActivityAction, withdrawActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

/**
 * Closes out a record that should not count: replaced by another record, or entered by mistake. A withdrawn
 * record leaves the reports and the "not accepted" counts; a manager can bring it back.
 */
export function ActivityLifecyclePanel({
  activityId,
  withdrawn,
  supersededByLabel,
  canWithdraw,
  replacements,
}: {
  activityId: string;
  withdrawn: boolean;
  supersededByLabel?: string;
  canWithdraw: boolean;
  replacements: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [replacementId, setReplacementId] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function withdraw() {
    const result = await actionState.run(() => withdrawActivityAction(activityId, replacementId || undefined));
    setConfirm(false);
    if (result) router.refresh();
  }

  async function restore() {
    const result = await actionState.run(() => restoreActivityAction(activityId));
    if (result) router.refresh();
  }

  return (
    <section aria-labelledby="lifecycle-title" className="card space-y-3">
      <h2 id="lifecycle-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">{withdrawn ? "This record is withdrawn" : "Replaced or entered by mistake?"}</h2>
      {withdrawn ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            It is left out of reports and no longer counts as “not accepted”.{supersededByLabel ? ` It was replaced by ${supersededByLabel}.` : ""}
          </p>
          {canWithdraw && <Button variant="secondary" onClick={() => void restore()} pending={actionState.busy}>Restore this record</Button>}
        </>
      ) : (
        canWithdraw && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">Withdraw it so it stops counting. Nothing is deleted, and it can be restored.</p>
            <Field label="Replaced by (optional)" htmlFor="supersededBy">
              <Select id="supersededBy" value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
                <option value="">Not replaced by another record</option>
                {replacements.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" onClick={() => setConfirm(true)} disabled={actionState.busy}>Withdraw this record</Button>
            <ConfirmDialog
              open={confirm}
              onClose={() => setConfirm(false)}
              onConfirm={() => withdraw()}
              pending={actionState.busy}
              title="Withdraw this record?"
              message="It will be left out of reports. You can restore it later."
              confirmLabel="Withdraw"
            />
          </>
        )
      )}
      {actionState.error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>}
    </section>
  );
}
