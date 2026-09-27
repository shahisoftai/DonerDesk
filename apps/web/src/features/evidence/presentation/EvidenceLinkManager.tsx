"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { attachEvidenceAction, detachEvidenceAction } from "@/lib/actions/activities";

export type LinkTarget = {
  type: "activity" | "indicator";
  /** ActivityUpdate id for "activity", IndicatorUpdate id for "indicator". */
  id: string;
  label: string;
  linked: boolean;
};

/**
 * Manual evidence linking. Report generation only sees evidence attached to an
 * activity or indicator update, so this lets a user attach a file to any
 * activity or indicator record in the project (and remove a wrong link),
 * complementing the title-similarity "Suggest links" helper.
 */
export function EvidenceLinkManager({ evidenceId, targets }: { evidenceId: string; targets: LinkTarget[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linked = targets.filter((t) => t.linked);
  const available = targets.filter((t) => !t.linked);
  const key = (t: LinkTarget) => `${t.type}:${t.id}`;

  async function run(t: LinkTarget, action: typeof attachEvidenceAction) {
    setBusy(key(t));
    setError(null);
    const result = await action({
      evidenceId,
      activityId: t.type === "activity" ? t.id : undefined,
      indicatorId: t.type === "indicator" ? t.id : undefined,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setChoice("");
    router.refresh();
  }

  const selected = available.find((t) => key(t) === choice);

  return (
    <div className="space-y-1.5 text-xs">
      {linked.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Not linked</p>
      ) : (
        <ul className="space-y-1">
          {linked.map((t) => (
            <li key={key(t)} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300" title={t.label}>
                {t.type === "activity" ? "Activity" : "Indicator"}: {t.label}
              </span>
              <button
                type="button"
                onClick={() => void run(t, detachEvidenceAction)}
                disabled={busy === key(t)}
                aria-label={`Remove link to ${t.label}`}
                className="shrink-0 text-danger-700 hover:underline disabled:opacity-50 dark:text-danger-400"
              >
                {busy === key(t) ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Link this file to an activity or indicator"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="min-w-0 max-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Link to…</option>
            <optgroup label="Activities">
              {available.filter((t) => t.type === "activity").map((t) => <option key={key(t)} value={key(t)}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Indicators">
              {available.filter((t) => t.type === "indicator").map((t) => <option key={key(t)} value={key(t)}>{t.label}</option>)}
            </optgroup>
          </select>
          <button
            type="button"
            disabled={!selected || busy !== null}
            onClick={() => selected && void run(selected, attachEvidenceAction)}
            className="shrink-0 rounded-md border border-brand-300 px-2 py-1 font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
          >
            Link
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-danger-700 dark:text-danger-400">{error}</p>}
    </div>
  );
}
