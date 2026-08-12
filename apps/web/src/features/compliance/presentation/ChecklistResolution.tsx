"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveChecklistItemAction } from "@/lib/actions/compliance";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

type Decision = "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START";

export function ChecklistResolution({ itemId, severity }: { itemId: string; severity: string }) {
  const router = useRouter();
  const actionState = useActionState();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localNoteError, setLocalNoteError] = useState<string | undefined>();

  const highRisk = severity === "HIGH" || severity === "CRITICAL";

  function begin(d: Decision) {
    setDecision(d);
    setNotes("");
    setConfirming(false);
    setLocalNoteError(undefined);
  }

  async function submit() {
    if (!decision) return;
    const trimmed = notes.trim();
    if (decision !== "START" && !trimmed) {
      setLocalNoteError("A note is required to record how this item was resolved.");
      return;
    }
    setLocalNoteError(undefined);
    const result = await actionState.run(() => resolveChecklistItemAction(itemId, decision));
    if (result !== undefined) {
      setDecision(null);
      router.refresh();
    }
  }

  return (
    <div className="mt-2">
      {!decision && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => begin("START")}>Start</Button>
          <Button size="sm" onClick={() => begin("RESOLVE")}>Resolve</Button>
          <Button size="sm" variant="secondary" onClick={() => begin("ACCEPT_RISK")}>Accept risk</Button>
          <Button size="sm" variant="secondary" onClick={() => begin("NOT_APPLICABLE")}>Not applicable</Button>
        </div>
      )}

      {decision && (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <Field
            label="Note"
            htmlFor={`note-${itemId}`}
            error={localNoteError ?? actionState.fields?.notes?.[0]}
            description={decision === "START" ? "Optional — record why you are starting work on this item." : "Record how this item was resolved."}
          >
            <Textarea
              id={`note-${itemId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              invalid={Boolean(localNoteError ?? actionState.fields?.notes)}
              maxLength={2000}
              rows={2}
            />
          </Field>

          {decision !== "START" && !confirming && (
            <Button size="sm" variant={decision === "ACCEPT_RISK" ? "secondary" : "primary"} onClick={() => setConfirming(true)}>
              Confirm
            </Button>
          )}

          {decision !== "START" && confirming && (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {decision === "ACCEPT_RISK" && highRisk
                  ? "This permanently accepts a high-severity risk. Confirm you have the authority to do so."
                  : decision === "ACCEPT_RISK"
                    ? "This records the item as an accepted risk."
                    : decision === "NOT_APPLICABLE"
                      ? "This marks the item as not applicable to this report."
                      : "This marks the item as resolved."}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={submit} pending={actionState.busy}>Confirm</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {decision === "START" && (
            <Button size="sm" onClick={submit} pending={actionState.busy}>Start work</Button>
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
