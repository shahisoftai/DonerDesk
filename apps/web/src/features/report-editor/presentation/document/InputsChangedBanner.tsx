"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Report Editor U13: indicator values or evidence changed after this draft
 * was written. Re-checking reassesses the affected sections against the new
 * data without rewriting the text. Tables and figures were built when the draft was written, so only rewriting the
 * affected sections brings them up to date; that is a separate, confirmed action.
 */
export function InputsChangedBanner({
  indicators,
  evidence,
  sectionCount,
  canRecheck,
  pending,
  onRecheck,
  canRewrite = false,
  rewriting = false,
  onRewrite,
  onDismiss,
}: {
  indicators: number;
  evidence: number;
  sectionCount: number;
  canRecheck: boolean;
  pending: boolean;
  onRecheck: () => void;
  /** Rewrites the affected sections from the current data (the only way a table picks up a new value). */
  canRewrite?: boolean;
  rewriting?: boolean;
  onRewrite?: () => void;
  onDismiss: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const parts = [indicators > 0 ? plural(indicators, "indicator value") : null, evidence > 0 ? plural(evidence, "evidence file") : null].filter(Boolean);
  return (
    <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info-500/30 bg-info-50 px-3 py-2 text-sm text-info-700 dark:bg-info-500/10 dark:text-info-300">
      <span>
        {parts.join(" and ")} changed since this draft was written
        {sectionCount > 0 ? ` · ${plural(sectionCount, "section")} affected` : ""}.
      </span>
      <span className="flex gap-2">
        {canRecheck && (
          <Button size="sm" variant="secondary" pending={pending} onClick={onRecheck}>
            Re-check statements only
          </Button>
        )}
        {canRewrite && onRewrite && !confirming && (
          <Button size="sm" variant="primary" pending={rewriting} onClick={() => setConfirming(true)}>
            Rewrite affected sections
          </Button>
        )}
        {canRewrite && onRewrite && confirming && (
          <>
            <span className="self-center text-xs">Rewrites the text and tables from the current data; the old text stays in history.</span>
            <Button size="sm" variant="primary" pending={rewriting} onClick={() => { setConfirming(false); onRewrite(); }}>
              Yes, rewrite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    </div>
  );
}
