"use client";

import { useState, useTransition } from "react";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { notUsedAnswer } from "../domain/pcw-view";

/**
 * "Not used for this project" for one requirement: an answer, not a gap. The reason is optional. Shown only for
 * requirements the project may leave out; the server refuses the answer for anything the project needs.
 */
export function NotUsedToggle({ id, view, requirement, onView, label }: { id: string; view: SetupDraftView; requirement: string; onView: (v: SetupDraftView) => void; label?: string }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const current = notUsedAnswer(view, requirement);
  const [reason, setReason] = useState(current.reason);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const send = (operation: unknown) =>
    startTransition(async () => {
      const r = await editDraftAction(id, operation);
      if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message);
    });
  return (
    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <Checkbox
          checked={current.notUsed}
          onChange={(e) => send(e.target.checked ? { kind: "ANSWER_NOT_USED", requirement, ...(reason.trim() ? { reason: reason.trim() } : {}) } : { kind: "REOPEN_REQUIREMENT", requirement })}
        />
        {label ?? PCW_COPY.notUsed}
      </label>
      {current.notUsed ? (
        <Input aria-label={PCW_COPY.optionalReason} placeholder={PCW_COPY.optionalReason} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => reason.trim() !== current.reason && send({ kind: "ANSWER_NOT_USED", requirement, ...(reason.trim() ? { reason: reason.trim() } : {}) })} />
      ) : null}
      {error ? <p role="alert" className="text-danger-600">{error}</p> : null}
    </div>
  );
}
