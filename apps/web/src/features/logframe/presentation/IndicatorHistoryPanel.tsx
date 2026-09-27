"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  reviewIndicatorUpdateAction,
  verifyIndicatorUpdateAction,
  type IndicatorUpdateReviewDecision,
} from "@/lib/actions/indicators";
import type { IndicatorUpdateHistoryRow } from "@/lib/server/schemas";
import { StatusBadge } from "@/components/data/Badge";
import { INDICATOR_VERIFICATION_LABEL, REPORT_TYPE_LABEL } from "@/lib/labels";
import { indicatorVerificationTone } from "@/lib/shared/tone";
import { formatDate } from "@/lib/shared/dates";

const DECISION_LABEL: Record<IndicatorUpdateReviewDecision, string> = {
  "request-correction": "Request correction",
  reject: "Reject",
};

function allowedDecisions(status: string): IndicatorUpdateReviewDecision[] {
  if (status === "SUBMITTED") return ["request-correction", "reject"];
  if (status === "VERIFIED") return ["request-correction"];
  return [];
}

function canVerifyStatus(status: string): boolean {
  return status === "DRAFT" || status === "SUBMITTED" || status === "NEEDS_CORRECTION";
}

export function IndicatorHistoryPanel({
  rows,
  unit,
  canReview,
}: {
  rows: IndicatorUpdateHistoryRow[];
  unit?: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{ id: string; decision: IndicatorUpdateReviewDecision } | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => ReturnType<typeof verifyIndicatorUpdateAction>) {
    setBusyId(id);
    setError(null);
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPending(null);
    setReason("");
    router.refresh();
  }

  return (
    <section className="card mt-4" aria-label="Period updates and history">
      <h3 className="font-medium">Period updates and history</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          No values have been entered for this indicator yet. Values are entered per reporting period on the report inputs page.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3 text-right">This period</th>
                <th className="py-2 pr-3 text-right">Cumulative</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Comment</th>
                {canReview && <th className="py-2"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{row.periodReportType ? REPORT_TYPE_LABEL[row.periodReportType] ?? row.periodReportType : "Period"}</div>
                    <div className="text-xs text-slate-500">{formatDate(row.periodStart)} – {formatDate(row.periodEnd)}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatValue(row.periodAchievement, unit)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatValue(row.cumulativeAchievement, unit)}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge
                      tone={indicatorVerificationTone(row.verificationStatus)}
                      label={INDICATOR_VERIFICATION_LABEL[row.verificationStatus] ?? row.verificationStatus}
                    />
                  </td>
                  <td className="max-w-xs py-2 pr-3 text-slate-600 dark:text-slate-300">{row.comments || "—"}</td>
                  {canReview && (
                    <td className="py-2">
                      {pending?.id === row.id ? (
                        <form
                          className="flex min-w-56 flex-col gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(row.id, () => reviewIndicatorUpdateAction(row.id, pending.decision, { reason }));
                          }}
                        >
                          <label className="text-xs font-medium text-slate-500" htmlFor={`reason-${row.id}`}>
                            Reason ({DECISION_LABEL[pending.decision].toLowerCase()})
                          </label>
                          <textarea
                            id={`reason-${row.id}`}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                            rows={2}
                            maxLength={2000}
                            required
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="btn-primary" disabled={busyId === row.id || !reason.trim()}>
                              {DECISION_LABEL[pending.decision]}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => { setPending(null); setReason(""); }}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {canVerifyStatus(row.verificationStatus) && (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={busyId === row.id}
                              onClick={() => void run(row.id, () => verifyIndicatorUpdateAction(row.id))}
                            >
                              Verify
                            </button>
                          )}
                          {allowedDecisions(row.verificationStatus).map((decision) => (
                            <button
                              key={decision}
                              type="button"
                              className="btn-secondary"
                              disabled={busyId === row.id}
                              onClick={() => { setPending({ id: row.id, decision }); setReason(""); setError(null); }}
                            >
                              {DECISION_LABEL[decision]}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function formatValue(value: string, unit?: string): string {
  if (!value) return "—";
  return unit ? `${value} ${unit}` : value;
}
