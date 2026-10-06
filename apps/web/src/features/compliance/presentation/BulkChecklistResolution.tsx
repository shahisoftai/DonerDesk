"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkResolveChecklistAction } from "@/lib/actions/compliance";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { agree, countOf } from "@donordesk/domain/core/plural.js";

type Decision = "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START";

export function BulkChecklistResolution({
  periodId,
  itemIds,
  onDone,
}: {
  periodId: string;
  itemIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  async function submit() {
    if (!decision) return;
    const result = await actionState.run(() =>
      bulkResolveChecklistAction(periodId, itemIds, decision, notes.trim() || undefined),
    );
    if (result !== undefined) {
      setDecision(null);
      setNotes("");
      const refused = result.notPermitted ?? 0;
      setOutcome(`${countOf(result.resolved, "item")} updated${refused > 0 ? `. ${countOf(refused, "item")} ${agree(refused, "needs", "need")} a person to decide ${agree(refused, "it", "them")} one by one: only an administrator or project manager can attest to several at once.` : "."}`);
      onDone();
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {itemIds.length} item(s) selected
      </p>
      {!decision ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDecision("START")}>Start</Button>
          <Button size="sm" onClick={() => setDecision("RESOLVE")}>Resolve</Button>
          <Button size="sm" variant="secondary" onClick={() => setDecision("ACCEPT_RISK")}>Accept risk</Button>
          <Button size="sm" variant="secondary" onClick={() => setDecision("NOT_APPLICABLE")}>Not applicable</Button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <Field
            label="Note"
            htmlFor="bulk-note"
            description={decision === "START" ? "Optional — record why you are starting work." : "Shared note applied to all selected items."}
          >
            <Textarea
              id="bulk-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} pending={actionState.busy}>
              Apply "{decision.replace(/_/g, " ").toLowerCase()}" to {countOf(itemIds.length, "item")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDecision(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {outcome && <p role="status" className="mt-2 text-sm">{outcome}</p>}
      {actionState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </div>
  );
}
