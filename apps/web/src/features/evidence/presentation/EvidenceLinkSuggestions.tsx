"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { suggestEvidenceLinksAction, type EvidenceLinkSuggestion } from "@/lib/actions/evidence";
import { attachEvidenceAction } from "@/lib/actions/activities";

/**
 * On-demand "suggest links" affordance for an evidence file. Report generation
 * only sees evidence that is attached to an ActivityUpdate/IndicatorUpdate
 * (attachedEvidenceIds) — evidence with no link is silently invisible to
 * report drafting even though it's stored. This surfaces likely matches by
 * title similarity and requires an explicit click to attach; nothing is ever
 * linked automatically.
 */
export function EvidenceLinkSuggestions({ evidenceId, alreadyLinked }: { evidenceId: string; alreadyLinked: boolean }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<EvidenceLinkSuggestion[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSuggestions() {
    setLoading(true);
    setError(null);
    const result = await suggestEvidenceLinksAction(evidenceId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSuggestions(result.value);
  }

  async function attach(s: EvidenceLinkSuggestion) {
    const key = `${s.targetType}:${s.targetId}`;
    setBusyKey(key);
    setError(null);
    const result = await attachEvidenceAction({
      evidenceId,
      activityId: s.targetType === "activity" ? s.targetId : undefined,
      indicatorId: s.targetType === "indicator" ? s.targetId : undefined,
    });
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSuggestions((prev) => (prev ? prev.filter((x) => x.targetType !== s.targetType || x.targetId !== s.targetId) : prev));
    router.refresh();
  }

  if (suggestions === null) {
    return (
      <div>
        <button
          type="button"
          onClick={() => void loadSuggestions()}
          disabled={loading}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
        >
          {loading ? "Checking…" : alreadyLinked ? "Suggest more links" : "Suggest links"}
        </button>
        {error && <p role="alert" className="mt-1 text-xs text-danger-700 dark:text-danger-400">{error}</p>}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">No likely matches found.</p>;
  }

  return (
    <div className="space-y-1">
      {suggestions.map((s) => {
        const key = `${s.targetType}:${s.targetId}`;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300" title={s.targetLabel}>
              {s.targetType === "activity" ? "Activity" : "Indicator"}: {s.targetLabel}
            </span>
            <span className="shrink-0 text-slate-400">{Math.round(s.score * 100)}% match</span>
            <button
              type="button"
              onClick={() => void attach(s)}
              disabled={busyKey === key}
              className="shrink-0 rounded-md border border-brand-300 px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
            >
              {busyKey === key ? "Attaching…" : "Attach"}
            </button>
          </div>
        );
      })}
      {error && <p role="alert" className="mt-1 text-xs text-danger-700 dark:text-danger-400">{error}</p>}
    </div>
  );
}
