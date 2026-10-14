"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

/**
 * An accepted record that turns out to be wrong (a missing link, a typo, a wrong count) can be sent back for
 * correction. The server refuses, naming the report, when an approved report already used the record.
 */
export function ActivityReopenPanel({ activityId }: { activityId: string }) {
  const router = useRouter();
  const actionState = useActionState();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();

  async function submit() {
    const trimmed = note.trim();
    if (!trimmed) {
      setLocalError("Say what needs to be corrected, so the person who recorded it knows.");
      return;
    }
    setLocalError(undefined);
    const result = await actionState.run(() => reviewActivityAction({ activityId, decision: "REVISE", notes: trimmed }));
    if (result !== undefined) router.refresh();
  }

  return (
    <section aria-labelledby="reopen-title" className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h2 id="reopen-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">Something wrong in this accepted record?</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Send it back for correction: the text, location, participants and logframe link can then be changed and the record accepted again.
      </p>
      {!open ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Reopen for correction</Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="What needs to be corrected?" htmlFor="reopenNote" error={localError ?? actionState.fields?.notes?.[0] ?? actionState.error ?? undefined}>
            <Textarea dictate id="reopenNote" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} invalid={Boolean(localError)} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} pending={actionState.busy}>Send back for correction</Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}
