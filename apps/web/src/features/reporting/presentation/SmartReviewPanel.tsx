"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getSmartReviewAction, type SmartReviewSummaryShape } from "@/lib/actions/reporting";

function deepLink(projectId: string, periodId: string, item: SmartReviewSummaryShape["items"][number]): string {
  switch (item.action.type) {
    case "add-evidence":
    case "review-evidence":
      return item.evidenceId ? `/projects/${projectId}/evidence/${item.evidenceId}` : `/projects/${projectId}/evidence`;
    default:
      // Section-scoped items open the workspace on that section's editor,
      // where its statements and their decisions are listed.
      return item.sectionId
        ? `/projects/${projectId}/reports/${periodId}?section=${item.sectionId}&view=editor`
        : `/projects/${projectId}/reports/${periodId}?view=check`;
  }
}

/**
 * Increment 3 — Smart Review. The user's primary review surface.
 * Consumes the server-side Smart Review summary (grouped, plain-language gate
 * issues) and renders "N things need your attention". The detailed per-claim
 * review remains available behind "View details" (passed in as `detail`), but
 * it is no longer the primary experience.
 */
export function SmartReviewPanel({
  projectId,
  periodId,
  detail,
}: {
  projectId: string;
  periodId: string;
  detail?: ReactNode;
}) {
  const [summary, setSummary] = useState<SmartReviewSummaryShape | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let active = true;
    void getSmartReviewAction(periodId).then((r) => {
      if (!active) return;
      if (r.ok) setSummary(r.value);
    });
    return () => {
      active = false;
    };
  }, [periodId]);

  if (!summary) {
    return (
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Things to fix</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Checking your report…</p>
      </div>
    );
  }

  if (summary.issueCount === 0) {
    return (
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Things to fix</h3>
        <p className="rounded-md border border-success-500/30 bg-success-500/5 px-3 py-2 text-sm text-success-700 dark:text-success-400">
          🟢 No important issues found — your report is ready for final review.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Things to fix</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {summary.issueCount} thing{summary.issueCount === 1 ? "" : "s"} need attention
        </span>
      </div>

      <ul className="space-y-3">
        {summary.items.map((item) => {
          const href = deepLink(projectId, periodId, item);
          return (
            <li key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {item.blocksApproval ? "⚠️" : "🟡"} {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.explanation}</p>
                </div>
              </div>
              <div className="mt-2">
                <Link href={href} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {item.action.label}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {detail && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            {showDetail ? "Hide details" : "View details"}
          </button>
          {showDetail && <div className="mt-3">{detail}</div>}
        </div>
      )}
    </div>
  );
}
