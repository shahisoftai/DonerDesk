"use client";

import { useState } from "react";
import { ClaimResolutionActions } from "./ClaimResolutionActions";
import { BulkClaimResolution } from "./BulkClaimResolution";
import { SectionFlagsDecision } from "./SectionFlagsDecision";
import { flagClassCopy, verificationDetailCopy, verificationResultCopy } from "@/lib/reporting-copy";

export type ReviewClaim = {
  id: string;
  sectionId: string;
  text: string;
  verificationResult: string;
  verificationDetail: string;
  /** REPORT_ERROR / NEEDS_DECISION / UNCONFIRMED (absent on old payloads: treated as a decision). */
  flagClass?: string;
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
  canApproveSection = false,
  onResolved,
}: {
  claims: ReviewClaim[];
  sections: Array<{ id: string; sectionTitle: string }>;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  canApproveSection?: boolean;
  onResolved: () => void;
}) {
  const titleById = new Map(sections.map((s) => [s.id, s.sectionTitle]));
  const pending = claims.filter((c) => c.verificationResult === "FAILED" && !c.resolvedById);
  // Errors and decisions come first; "could not confirm" statements are grouped apart and collapsed.
  const unconfirmed = pending.filter((c) => c.flagClass === "UNCONFIRMED");
  const needsAttention = pending.filter((c) => c.flagClass !== "UNCONFIRMED");
  const unconfirmedBySection = new Map<string, ReviewClaim[]>();
  for (const c of unconfirmed) unconfirmedBySection.set(c.sectionId, [...(unconfirmedBySection.get(c.sectionId) ?? []), c]);
  const resolved = claims.filter((c) => c.verificationResult === "FAILED" && c.resolvedById);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === needsAttention.length ? new Set() : new Set(needsAttention.map((c) => c.id))));
  }

  if (pending.length === 0 && resolved.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-300">No statements to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {needsAttention.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {needsAttention.length} statement{needsAttention.length === 1 ? "" : "s"} need{needsAttention.length === 1 ? "s" : ""} your attention
            </h3>
            {canResolveClaim && needsAttention.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={selected.size === needsAttention.length}
                  onChange={toggleAll}
                  aria-label="Select all statements"
                />
                Select all
              </label>
            )}
          </div>
          {canResolveClaim && selected.size > 0 && (
            <div className="mt-3">
              <BulkClaimResolution
                claimIds={[...selected]}
                canOverrideConfidential={canOverrideConfidential}
                onDone={() => {
                  setSelected(new Set());
                  onResolved();
                }}
              />
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {needsAttention.map((c) => (
              <li key={c.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start gap-2">
                  {canResolveClaim && needsAttention.length > 1 && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      aria-label={`Select statement: ${c.text}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{titleById.get(c.sectionId) ?? "Report"}</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">{c.text}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">{flagClassCopy(c.flagClass).title}</p>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                      {verificationResultCopy(c.verificationResult)}
                      {verificationDetailCopy(c.verificationDetail) ? ` — ${verificationDetailCopy(c.verificationDetail)}` : ""}
                    </p>
                    <ClaimResolutionActions
                      claimId={c.id}
                      canResolve={canResolveClaim}
                      canOverrideConfidential={canOverrideConfidential}
                      onResolved={onResolved}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {unconfirmed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
            {flagClassCopy("UNCONFIRMED").title} ({unconfirmed.length})
          </summary>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{flagClassCopy("UNCONFIRMED").hint}</p>
          <div className="mt-3 space-y-4">
            {[...unconfirmedBySection.entries()].map(([sectionId, list]) => (
              <div key={sectionId}>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{titleById.get(sectionId) ?? "Report"}</p>
                <ul className="mt-1 space-y-1">
                  {list.map((c) => (
                    <li key={c.id} className="rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-white/10 dark:bg-white/5">
                      <p className="text-slate-700 dark:text-slate-200">{c.text}</p>
                      {verificationDetailCopy(c.verificationDetail) && (
                        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{verificationDetailCopy(c.verificationDetail)}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {canResolveClaim && (
                  <div className="mt-2">
                    <SectionFlagsDecision
                      sectionId={sectionId}
                      sectionTitle={titleById.get(sectionId) ?? "Section"}
                      count={list.length}
                      canApprove={canApproveSection}
                      onDone={onResolved}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
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
