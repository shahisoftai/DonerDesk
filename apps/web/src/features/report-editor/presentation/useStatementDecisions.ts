"use client";

import { useCallback, useState } from "react";
import { applyClaimSuggestionAction, reopenReportClaimAction, resolveReportClaimAction, updateReportSectionAction } from "@/lib/actions/reporting";
import type { useToast } from "@/components/feedback/Toast";
import type { InspectorClaim, StatementDecision, Suggestion } from "./inspector/StatementsTab";

/** How long "Undo" stays on the toast after a decision (Report Editor U7). */
export const DECISION_UNDO_MS = 10_000;

type Toast = ReturnType<typeof useToast>;

/**
 * Statement decisions with undo (Report Editor U6/U7): keep with a note,
 * leave out, use the evidence value. Every decision shows a 10-second
 * "Undo"; decided statements keep an "Undo decision" link.
 */
export function useStatementDecisions({ toast, refresh }: { toast: Toast; refresh: () => void }) {
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);

  const undo = useCallback(
    async (claimId: string) => {
      setBusyClaimId(claimId);
      const result = await reopenReportClaimAction(claimId);
      setBusyClaimId(null);
      if (!result.ok) {
        toast.push({ title: result.error.message, tone: "danger" });
        return;
      }
      toast.push({ title: "Decision undone — the statement needs a decision again", tone: "neutral" });
      refresh();
    },
    [toast, refresh],
  );

  const decide = useCallback(
    async (claim: InspectorClaim, decision: StatementDecision, notes: string): Promise<boolean> => {
      setBusyClaimId(claim.id);
      const result = await resolveReportClaimAction(claim.id, {
        resolution: decision === "keep" ? "ACCEPTED_WITH_LIMITATION" : "EXCLUDED",
        notes: notes || undefined,
      });
      setBusyClaimId(null);
      if (!result.ok) {
        toast.push({ title: result.error.message, tone: "danger" });
        return false;
      }
      toast.push({
        title: decision === "keep" ? "Statement kept with your note" : "Statement left out of the report",
        tone: "success",
        durationMs: DECISION_UNDO_MS,
        action: { label: "Undo", onAction: () => void undo(result.value.claimId) },
      });
      refresh();
      return true;
    },
    [toast, refresh, undo],
  );

  const applyEvidence = useCallback(
    async (claim: InspectorClaim, suggestion: Suggestion, expectedVersion: string) => {
      setBusyClaimId(claim.id);
      const result = await applyClaimSuggestionAction(claim.id, expectedVersion);
      setBusyClaimId(null);
      if (!result.ok) {
        toast.push({ title: result.error.message, tone: "danger" });
        refresh();
        return;
      }
      const { sectionId, version, previousContent } = result.value;
      toast.push({
        title: `Changed ${suggestion.from} to ${suggestion.to} and re-checked the section`,
        tone: "success",
        durationMs: DECISION_UNDO_MS,
        action: {
          label: "Undo",
          onAction: () =>
            void updateReportSectionAction(sectionId, { content: previousContent, expectedVersion: version, changeOrigin: "RESTORE" }).then((r) => {
              if (!r.ok) toast.push({ title: r.error.message, tone: "danger" });
              refresh();
            }),
        },
      });
      refresh();
    },
    [toast, refresh],
  );

  return { busyClaimId, decide, undo, applyEvidence };
}
