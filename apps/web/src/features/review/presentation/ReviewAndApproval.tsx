"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveReportAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { can, type Capability } from "@/lib/shared/capabilities";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { evaluatePreApproval } from "@/features/review/application/preapproval";

export function ReviewAndApproval({
  draftId,
  draftStatus,
  sections,
  checklist,
  unverifiedIndicatorCount,
  sensitiveEvidenceCount,
  capabilities,
}: {
  draftId: string;
  draftStatus: string;
  sections: Array<{ status: string }>;
  checklist: Array<{ severity: string; status: string }>;
  unverifiedIndicatorCount: number;
  sensitiveEvidenceCount: number;
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [confirming, setConfirming] = useState(false);

  const canApprove = can(capabilities, "report.approve");
  const issues = evaluatePreApproval({
    draftStatus,
    sections,
    checklist,
    unverifiedIndicatorCount,
    sensitiveEvidenceCount,
  });
  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");
  const approvalAvailable = canApprove && draftStatus === "UNDER_REVIEW";

  async function approve() {
    const result = await actionState.run(() => approveReportAction(draftId));
    if (result !== undefined) {
      setConfirming(false);
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="review-title" className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="review-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Review &amp; approval
        </h2>
        <Badge tone="info">{draftStatus.replace(/_/g, " ")}</Badge>
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-success-700 dark:text-success-400">
          No blocking or warning issues found. This report is ready for approval.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {blocking.map((issue) => (
            <li key={issue.code} className="flex gap-2 text-sm">
              <Badge tone="danger">Blocking</Badge>
              <span className="text-slate-700 dark:text-slate-200">{issue.message}</span>
            </li>
          ))}
          {warnings.map((issue) => (
            <li key={issue.code} className="flex gap-2 text-sm">
              <Badge tone="warning">Warning</Badge>
              <span className="text-slate-700 dark:text-slate-200">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {approvalAvailable && (
        <div className="mt-4">
          {blocking.length > 0 ? (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Blocking issues are present. Approval is server-confirmed, so you may still attempt it, but it is not
                recommended until these are resolved.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Approve this report to lock the version for export. Approval is recorded in the audit trail.
            </p>
          )}

          {!confirming ? (
            <Button size="sm" className="mt-2" onClick={() => setConfirming(true)}>
              Approve report
            </Button>
          ) : (
            <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {blocking.length > 0
                  ? "There are unresolved blocking issues. Approve anyway?"
                  : "Confirm approval of this report version?"}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={approve} pending={actionState.busy}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canApprove && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          You do not have permission to approve reports.
        </p>
      )}

      {actionState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}
    </section>
  );
}
