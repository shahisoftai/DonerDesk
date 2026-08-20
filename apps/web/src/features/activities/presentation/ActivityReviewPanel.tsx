"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

type Decision = "ACCEPT" | "REVISE" | "REJECT";

export function ActivityReviewPanel({ activityId }: { activityId: string }) {
  const router = useRouter();
  const actionState = useActionState();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localNoteError, setLocalNoteError] = useState<string | undefined>();

  function begin(d: Decision) {
    setDecision(d);
    setNotes("");
    setConfirming(false);
    setLocalNoteError(undefined);
  }

  async function submit() {
    if (!decision) return;
    const trimmed = notes.trim();
    if (decision !== "ACCEPT" && !trimmed) {
      setLocalNoteError("A note is required to explain this decision.");
      return;
    }
    setLocalNoteError(undefined);
    const result = await actionState.run(() =>
      reviewActivityAction({ activityId, decision, notes: trimmed || undefined }),
    );
    if (result !== undefined) {
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="review-title" className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h2 id="review-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">
        Review activity update
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Approve this update for reporting, request a revision, or reject it.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={decision === "ACCEPT" ? "primary" : "secondary"} onClick={() => begin("ACCEPT")}>
          Accept
        </Button>
        <Button size="sm" variant="secondary" onClick={() => begin("REVISE")}>
          Request revision
        </Button>
        <Button size="sm" variant={decision === "REJECT" ? "danger" : "secondary"} onClick={() => begin("REJECT")}>
          Reject
        </Button>
      </div>

      {decision && (
        <div className="mt-4 space-y-3">
          <Field
            label="Note"
            htmlFor="reviewNote"
            error={localNoteError ?? actionState.fields?.notes?.[0]}
            description={
              decision === "ACCEPT"
                ? "Optional — record any context for the audit trail."
                : "Required — explain what needs to change or why this is rejected."
            }
          >
            <Textarea
              id="reviewNote"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              invalid={Boolean(localNoteError ?? actionState.fields?.notes)}
              maxLength={2000}
              rows={3}
            />
          </Field>

          {decision !== "ACCEPT" && !confirming && (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              {decision === "REVISE" ? "Send revision request" : "Reject activity"}
            </Button>
          )}

          {decision !== "ACCEPT" && confirming && (
            <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {decision === "REVISE"
                  ? "This sends the update back to the submitter for revision. Are you sure?"
                  : "This permanently rejects the activity update. This cannot be undone. Are you sure?"}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={submit} pending={actionState.busy}>
                  Confirm
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {decision === "ACCEPT" && (
            <Button size="sm" onClick={submit} pending={actionState.busy}>
              Accept and submit
            </Button>
          )}
        </div>
      )}

      {actionState.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </section>
  );
}
