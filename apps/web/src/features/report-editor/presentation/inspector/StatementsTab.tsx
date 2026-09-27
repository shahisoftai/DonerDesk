"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/data/Badge";
import { ClaimResolutionActions } from "@/features/reporting/presentation/ClaimResolutionActions";
import { evidenceLabelCopy, verificationDetailCopy, verificationResultCopy } from "@/lib/reporting-copy";
import type { SourceRef } from "./SourcesTab";

export type InspectorClaim = {
  id: string;
  sectionId: string;
  text: string;
  verificationResult: string;
  verificationDetail: string;
  resolutionNotes?: string | null;
  resolvedById?: string;
  sources?: Array<{ evidenceId: string; chunkId: string; sourceText: string }>;
};

function rank(c: InspectorClaim): number {
  if (c.verificationResult === "FAILED" && !c.resolvedById) return 0;
  if (c.resolvedById) return 1;
  return 2;
}

/**
 * Every checked statement in the selected section: the ones that need a
 * decision first (with the resolution actions), then resolved ones, then
 * statements that match the evidence.
 */
export function StatementsTab({
  claims,
  sourceReferences,
  focusClaimId,
  canResolveClaim,
  canOverrideConfidential,
  onResolved,
}: {
  claims: InspectorClaim[];
  sourceReferences?: SourceRef[];
  focusClaimId?: string;
  canResolveClaim: boolean;
  canOverrideConfidential: boolean;
  onResolved: () => void;
}) {
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    focusRef.current?.focus();
  }, [focusClaimId]);

  if (claims.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">No factual statements were checked in this section.</p>;
  }

  const sorted = [...claims].sort((a, b) => rank(a) - rank(b));
  const open = sorted.filter((c) => rank(c) === 0).length;

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {open > 0
          ? `${open} of ${claims.length} statement${claims.length === 1 ? "" : "s"} need${open === 1 ? "s" : ""} your decision.`
          : `All ${claims.length} statement${claims.length === 1 ? " is" : "s are"} backed by evidence or resolved.`}
      </p>
      <ul className="space-y-2.5">
        {sorted.map((c) => {
          const isOpen = rank(c) === 0;
          const focused = c.id === focusClaimId;
          const detail = isOpen ? verificationDetailCopy(c.verificationDetail) : "";
          return (
            <li
              key={c.id}
              ref={focused ? focusRef : undefined}
              tabIndex={focused ? -1 : undefined}
              className={`rounded-lg border p-3 text-sm outline-none ${
                isOpen ? "border-warning-500/50 bg-warning-50/60 dark:bg-warning-500/5" : "border-slate-200 dark:border-white/10"
              } ${focused ? "ring-2 ring-warning-500/40" : ""}`}
            >
              <Badge tone={isOpen ? "warning" : c.resolvedById ? "success" : "info"}>
                {c.resolvedById ? "Resolved" : verificationResultCopy(c.verificationResult)}
              </Badge>
              <p className="mt-2 font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">“{c.text}”</p>
              {detail && <p className="mt-1.5 text-slate-600 dark:text-slate-300">{detail}</p>}
              {c.resolvedById && c.resolutionNotes && (
                <p className="mt-1.5 text-success-700 dark:text-success-400">Note: {c.resolutionNotes}</p>
              )}
              {c.sources && c.sources.length > 0 && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Source: {Array.from(new Set(c.sources.map((s) => evidenceLabelCopy(s.evidenceId, sourceReferences)))).join(", ")}
                </p>
              )}
              {isOpen && (
                <ClaimResolutionActions
                  claimId={c.id}
                  canResolve={canResolveClaim}
                  canOverrideConfidential={canOverrideConfidential}
                  onResolved={onResolved}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
