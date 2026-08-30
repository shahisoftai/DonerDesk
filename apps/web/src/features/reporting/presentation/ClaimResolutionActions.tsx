"use client";

import { useState } from "react";
import { resolveReportClaimAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";

/**
 * Inline resolution controls for a failed report statement. Lets a reviewer
 * accept the statement with a written limitation (it stays in the report,
 * flagged as approved-with-caveat) or exclude it, without leaving the report
 * workspace. Requires the report.resolve-claim capability, surfaced by the
 * parent via `canResolve`.
 */
export function ClaimResolutionActions({
  claimId,
  canResolve,
  canOverrideConfidential,
  onResolved,
}: {
  claimId: string;
  canResolve: boolean;
  canOverrideConfidential: boolean;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState<null | "ACCEPTED_WITH_LIMITATION" | "EXCLUDED">(null);
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canResolve) return null;

  async function resolve() {
    if (!open) return;
    setResolving(true);
    setError(null);
    const result = await resolveReportClaimAction(claimId, {
      resolution: open,
      notes: notes.trim() || undefined,
    });
    setResolving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(null);
    setNotes("");
    onResolved();
  }

  return (
    <div className="mt-1.5">
      {!open && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpen("ACCEPTED_WITH_LIMITATION")}>
            Accept with note
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen("EXCLUDED")}>
            Exclude
          </Button>
        </div>
      )}
      {open && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/60">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {open === "ACCEPTED_WITH_LIMITATION"
              ? "Accept this statement with a written limitation. It stays in the report, flagged as approved-with-caveat."
              : canOverrideConfidential
                ? "Exclude this statement from the report. You have the authority required for confidential sources."
                : "Exclude this statement from the report."}
          </p>
          <textarea
            aria-label={open === "ACCEPTED_WITH_LIMITATION" ? "Limitation note" : "Exclusion note"}
            className="block w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              open === "ACCEPTED_WITH_LIMITATION"
                ? "Why is this statement acceptable despite the issue?"
                : "Reason for exclusion (optional)"
            }
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setOpen(null); setNotes(""); setError(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={resolve}
              pending={resolving}
              disabled={open === "ACCEPTED_WITH_LIMITATION" && notes.trim().length === 0}
            >
              {open === "ACCEPTED_WITH_LIMITATION" ? "Accept with note" : "Exclude statement"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-danger-700 dark:text-danger-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
