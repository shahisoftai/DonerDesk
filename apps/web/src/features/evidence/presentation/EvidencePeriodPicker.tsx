"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEvidencePeriodAction } from "@/lib/actions/evidence";

export type PeriodOption = { id: string; label: string };

/**
 * Inline "Reporting period" selector for an evidence file. Linking evidence to
 * the period it supports makes it count toward that period's readiness
 * "Evidence" score and includes it in the report's evidence packages.
 */
export function EvidencePeriodPicker({
  evidenceId,
  currentPeriodId,
  periods,
}: {
  evidenceId: string;
  currentPeriodId: string | null;
  periods: PeriodOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(value: string) {
    const next = value === "" ? null : value;
    if (next === currentPeriodId) return;
    setBusy(true);
    setError(null);
    const result = await setEvidencePeriodAction(evidenceId, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        aria-label="Reporting period"
        value={currentPeriodId ?? ""}
        onChange={(e) => void onChange(e.target.value)}
        disabled={busy || periods.length === 0}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900"
      >
        <option value="">Not linked</option>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      {error && <p role="alert" className="mt-1 text-xs text-danger-700 dark:text-danger-400">{error}</p>}
    </div>
  );
}
