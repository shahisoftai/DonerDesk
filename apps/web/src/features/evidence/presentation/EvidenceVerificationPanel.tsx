"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewEvidenceAction, type EvidenceReviewDecision } from "@/lib/actions/evidence";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

type Pending = "VERIFY" | "REQUEST_CORRECTION" | "REJECT" | "ARCHIVE" | "RESTORE" | null;

const STATE_TEXT: Record<string, string> = {
  VERIFIED: "This file is verified.",
  NEEDS_CORRECTION: "A correction was asked for.",
  REJECTED: "This file was rejected.",
  ARCHIVED: "This file is archived.",
};

/** Which decisions a reviewer is offered in each state (the server applies the same rules, `checkEvidenceReview`). */
const OFFERS: Record<string, Array<Exclude<Pending, null>>> = {
  UPLOADED: ["VERIFY", "REQUEST_CORRECTION", "REJECT", "ARCHIVE"],
  AI_TAGGED: ["VERIFY", "REQUEST_CORRECTION", "REJECT", "ARCHIVE"],
  PENDING_REVIEW: ["VERIFY", "REQUEST_CORRECTION", "REJECT", "ARCHIVE"],
  NEEDS_CORRECTION: ["VERIFY", "REJECT", "ARCHIVE"],
  VERIFIED: ["REQUEST_CORRECTION", "REJECT", "ARCHIVE"],
  REJECTED: ["RESTORE", "ARCHIVE"],
  ARCHIVED: ["RESTORE"],
};

const LABEL: Record<Exclude<Pending, null>, string> = {
  VERIFY: "Verify evidence",
  REQUEST_CORRECTION: "Ask for a correction",
  REJECT: "Reject",
  ARCHIVE: "Archive",
  RESTORE: "Bring back for review",
};

const NEEDS_NOTE: ReadonlySet<string> = new Set(["REQUEST_CORRECTION", "REJECT"]);

/**
 * What a reviewer can do with this file. A correction request and a rejection need a reason the uploader can read; a file a report
 * already relies on cannot be rejected or archived (the server says which report).
 */
export function EvidenceVerificationPanel({
  evidenceId,
  verificationStatus,
  sensitive,
  reviewNote,
}: {
  evidenceId: string;
  verificationStatus: string;
  sensitive: boolean;
  reviewNote?: string | undefined;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [choice, setChoice] = useState<Pending>(null);
  const [note, setNote] = useState("");

  async function confirm() {
    if (!choice) return;
    const decision: EvidenceReviewDecision = NEEDS_NOTE.has(choice) ? ({ action: choice, note } as EvidenceReviewDecision) : ({ action: choice } as EvidenceReviewDecision);
    const result = await actionState.run(() => reviewEvidenceAction(evidenceId, decision));
    if (result !== undefined) {
      setChoice(null);
      setNote("");
      router.refresh();
    }
  }

  const offers = OFFERS[verificationStatus] ?? [];
  return (
    <section aria-labelledby="verify-title" className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h2 id="verify-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">Verification</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {STATE_TEXT[verificationStatus] ?? "Confirm this evidence is accurate and suitable for reporting."} Every decision is recorded in the audit trail.
        {sensitive && " This file is marked sensitive: check who may open it."}
      </p>
      {reviewNote && (verificationStatus === "NEEDS_CORRECTION" || verificationStatus === "REJECTED") && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Reviewer: {reviewNote}</p>
      )}

      {!choice ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {offers.map((o) => (
            <Button key={o} size="sm" variant={o === "VERIFY" ? "primary" : "secondary"} onClick={() => setChoice(o)}>{LABEL[o]}</Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">{LABEL[choice]}?</p>
          {NEEDS_NOTE.has(choice) && (
            <Textarea className="mt-2" aria-label="Reason" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say why, so the person who uploaded it knows what to fix." />
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={confirm} pending={actionState.busy} disabled={NEEDS_NOTE.has(choice) && note.trim() === ""}>Confirm</Button>
            <Button size="sm" variant="secondary" onClick={() => { setChoice(null); setNote(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {actionState.error && <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>}
    </section>
  );
}
