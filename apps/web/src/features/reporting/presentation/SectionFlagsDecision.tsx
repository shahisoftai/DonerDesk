"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSectionFlagsAction } from "@/lib/actions/reporting";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const MIN_NOTE = 10;

/**
 * One explained decision for a section: accept every "could not confirm" statement with the same
 * note and, when allowed, approve the section. Figure errors are never part of it; the server
 * returns whatever still needs a person.
 */
export function SectionFlagsDecision({
  sectionId,
  sectionTitle,
  count,
  canApprove,
  onDone,
}: {
  sectionId: string;
  sectionTitle: string;
  count: number;
  canApprove: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [approve, setApprove] = useState(canApprove);
  const [busy, setBusy] = useState(false);
  const valid = note.trim().length >= MIN_NOTE;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const result = await resolveSectionFlagsAction({ sectionId, note: note.trim(), approve: canApprove && approve });
      if (!result.ok) {
        toast.push({ title: "Could not record the decision", description: result.error.message, tone: "danger" });
        return;
      }
      const { resolved, approved, remaining } = result.value;
      toast.push({
        title: approved ? `${sectionTitle} approved` : `${resolved} statement${resolved === 1 ? "" : "s"} accepted`,
        description: remaining.length > 0 ? `${remaining.length} statement${remaining.length === 1 ? " still needs" : "s still need"} your attention before the section can be approved.` : undefined,
        tone: remaining.length > 0 ? "warning" : "success",
      });
      setOpen(false);
      setNote("");
      onDone();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Accept the {count} unconfirmed statement{count === 1 ? "" : "s"}{canApprove ? " and approve" : ""}
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-white/10">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200" htmlFor={`flags-note-${sectionId}`}>
        Why are these acceptable? (recorded with each statement)
      </label>
      <Textarea id={`flags-note-${sectionId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Reviewed by the programme lead against field notes." />
      {!valid && note.length > 0 && <p className="text-xs text-slate-500">At least {MIN_NOTE} characters.</p>}
      {canApprove && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          Also approve this section if nothing else blocks it
        </label>
      )}
      <div className="flex gap-2">
        <Button size="sm" pending={busy} disabled={!valid} onClick={() => void submit()}>Confirm decision</Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
