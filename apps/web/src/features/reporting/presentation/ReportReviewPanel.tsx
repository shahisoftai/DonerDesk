"use client";

import { ClaimResolutionActions } from "./ClaimResolutionActions";

export type ReviewClaim = {
  id: string;
  sectionId: string;
  text: string;
  verificationResult: string;
  verificationDetail: string;
  resolutionNotes?: string | null;
  resolvedById?: string;
};

/**
 * Aggregated review surface for the report workspace: every statement that
 * still needs a decision, grouped per section, with inline Accept/Exclude
 * actions. Statements the reviewer already resolved are listed below as a
 * record of decisions.
 */
export function ReportReviewPanel({
  claims,
  sections,
  canResolveClaim,
  canOverrideConfidential,
  onResolved,
}: {
  claims: ReviewClaim[];
  sections: Array<{ id: string; sectionTitle: string }>;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  onResolved: () => void;
}) {
  const titleById = new Map(sections.map((s) => [s.id, s.sectionTitle]));
  const pending = claims.filter((c) => c.verificationResult === "FAILED" && !c.resolvedById);
  const resolved = claims.filter((c) => c.verificationResult === "FAILED" && c.resolvedById);

  if (pending.length === 0 && resolved.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-300">No statements to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <section className="card">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {pending.length} statement{pending.length === 1 ? "" : "s"} need a decision
          </h3>
          <ul className="mt-3 space-y-2">
            {pending.map((c) => (
              <li key={c.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{titleById.get(c.sectionId) ?? "Report"}</p>
                <p className="mt-1 text-slate-700 dark:text-slate-200">{c.text}</p>
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Verification: {c.verificationResult} — {c.verificationDetail}
                </p>
                <ClaimResolutionActions
                  claimId={c.id}
                  canResolve={canResolveClaim}
                  canOverrideConfidential={canOverrideConfidential}
                  onResolved={onResolved}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {resolved.length > 0 && (
        <section className="card">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Resolved statements ({resolved.length})</h3>
          <ul className="mt-3 space-y-2">
            {resolved.map((c) => (
              <li key={c.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-slate-700 line-through dark:text-slate-300">{c.text}</p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  Resolved{c.resolutionNotes ? ` — ${c.resolutionNotes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
