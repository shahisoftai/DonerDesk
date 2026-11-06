"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDonorIndicatorMappingAction } from "@/lib/actions/templates";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { InlineAlert } from "@/components/feedback/InlineAlert";

type Mapping = {
  indicators: Array<{ id: string; code: string; name: string }>;
  summary: { total: number; mapped: number; suggested: number; unmapped: number; notTracked: number };
  rows: Array<{
    requirementId: string;
    text: string;
    status: "MAPPED" | "SUGGESTED" | "UNMAPPED" | "NOT_TRACKED";
    indicatorId: string | null;
    indicatorCode: string | null;
    indicatorName: string | null;
    basis: string;
    alternatives: string[];
  }>;
};

const STATUS_LABEL: Record<Mapping["rows"][number]["status"], string> = {
  MAPPED: "Matched",
  SUGGESTED: "Please confirm",
  UNMAPPED: "No match yet",
  NOT_TRACKED: "Will not be reported",
};

const STATUS_STYLE: Record<Mapping["rows"][number]["status"], string> = {
  MAPPED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  SUGGESTED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  UNMAPPED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  NOT_TRACKED: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};

/**
 * The indicators the donor's template asks for, each with the project indicator that answers it. A match the donor's text names by
 * code is settled; a close wording is only a suggestion that a person confirms; an indicator nobody answers is said out loud, and a
 * person may record that the project will not report it. Nothing here changes an indicator or a value.
 */
export function DonorIndicatorMappingPanel({ templateId, mapping }: { templateId: string; mapping: Mapping }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(requirementId: string, decision: Parameters<typeof setDonorIndicatorMappingAction>[2]) {
    if (busy) return;
    setBusy(requirementId);
    setError(null);
    const result = await setDonorIndicatorMappingAction(templateId, requirementId, decision);
    setBusy(null);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  const { summary } = mapping;
  const open = summary.unmapped + summary.suggested;
  return (
    <section className="card mt-6 space-y-4" aria-labelledby="donor-indicators-heading">
      <div>
        <h2 id="donor-indicators-heading" className="text-lg font-semibold">Indicators the donor asks for</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {open === 0
            ? "Every indicator the donor asks for is matched or decided."
            : `${open} of ${summary.total} still need a decision. Match each to one of this project's indicators, or say it will not be reported.`}
        </p>
      </div>
      {error && <InlineAlert tone="danger" title={error} />}
      <ul className="divide-y divide-slate-200 dark:divide-white/10">
        {mapping.rows.map((row) => (
          <li key={row.requirementId} className="space-y-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-3xl text-sm">{row.text}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
            </div>
            <p className="text-xs text-slate-500">
              {row.indicatorCode ? <><span className="font-mono">{row.indicatorCode}</span> {row.indicatorName} · </> : null}
              {row.basis}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Project indicator for: ${row.text}`}
                value={row.status === "NOT_TRACKED" ? "" : row.indicatorId ?? ""}
                disabled={!hydrated || busy !== null}
                onChange={(e) => e.target.value && void decide(row.requirementId, { action: "MAP", indicatorId: e.target.value })}
              >
                <option value="">Choose an indicator…</option>
                {mapping.indicators.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
              </Select>
              {row.status === "SUGGESTED" && row.indicatorId && (
                <Button variant="secondary" disabled={!hydrated || busy !== null} pending={busy === row.requirementId} onClick={() => void decide(row.requirementId, { action: "MAP", indicatorId: row.indicatorId! })}>Confirm this match</Button>
              )}
              {row.status !== "NOT_TRACKED" && (
                <Button variant="secondary" disabled={!hydrated || busy !== null} onClick={() => void decide(row.requirementId, { action: "NOT_TRACKED" })}>Will not be reported</Button>
              )}
              {(row.status === "NOT_TRACKED" || row.status === "MAPPED") && (
                <Button variant="secondary" disabled={!hydrated || busy !== null} onClick={() => void decide(row.requirementId, { action: "CLEAR" })}>Undo</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
