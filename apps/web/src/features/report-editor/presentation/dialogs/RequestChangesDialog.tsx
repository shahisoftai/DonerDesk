"use client";

import { useEffect, useId, useState } from "react";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";

const NOTES_MAX = 2000;

/**
 * Reviewer's "Request changes" (Report Editor U14): returns the report to
 * the writers as a draft. A comment is required so they know what to fix.
 */
export function RequestChangesDialog({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const id = useId();
  useEffect(() => {
    if (!open) setNotes("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Request changes">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (notes.trim()) onSubmit(notes.trim());
        }}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">The report goes back to the writers as a draft. Your comment is kept in the audit trail.</p>
        <label htmlFor={id} className="block text-sm font-medium">
          What needs to change?
        </label>
        <textarea
          id={id}
          required
          rows={4}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-900"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" pending={pending} disabled={!notes.trim()}>
            Send back to writers
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
