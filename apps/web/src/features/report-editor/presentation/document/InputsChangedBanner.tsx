"use client";

import { Button } from "@/components/ui/Button";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Report Editor U13: indicator values or evidence changed after this draft
 * was written. Re-checking reassesses the affected sections against the new
 * data; it never rewrites the text.
 */
export function InputsChangedBanner({
  indicators,
  evidence,
  sectionCount,
  canRecheck,
  pending,
  onRecheck,
  onDismiss,
}: {
  indicators: number;
  evidence: number;
  sectionCount: number;
  canRecheck: boolean;
  pending: boolean;
  onRecheck: () => void;
  onDismiss: () => void;
}) {
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
            Re-check affected sections
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    </div>
  );
}
