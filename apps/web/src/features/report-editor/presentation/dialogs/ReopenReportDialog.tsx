"use client";

import { useEffect, useId, useState } from "react";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const REASON_MAX = 1000;

/**
 * Reopen an approved, exported or submitted report for changes (for example, to add a chart after approval). The report goes
 * back to draft and has to be approved again; the reason is kept in the audit trail and shown on the report.
 */
export function ReopenReportDialog({
  open,
  status,
  version,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  status: string | null;
  version?: number | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const id = useId();
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);
  const submitted = status === "SUBMITTED";

  return (
    <Dialog open={open} onClose={onClose} title="Reopen this report for changes">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim().length >= 5) onSubmit(reason.trim());
        }}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The report{version ? ` (version ${version})` : ""} goes back to draft and its approval is cleared, so it has to be approved again. Sections stay approved until you change them;
          only a section you edit, or add a chart to, needs approving again. Exports already made are not changed.
        </p>
        {submitted && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
            This report was marked as submitted to the donor. Reopening it does not change what was sent, but anything you change now will differ from the submitted copy.
          </p>
        )}
        <label htmlFor={id} className="block text-sm font-medium">Why is it being reopened?</label>
        <Textarea dictate id={id} required rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: add the screening chart requested by the donor" />
        {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" pending={pending} disabled={reason.trim().length < 5}>Reopen report</Button>
        </div>
      </form>
    </Dialog>
  );
}
