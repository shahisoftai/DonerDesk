"use client";

import type { ReactNode } from "react";
import { SmartReviewPanel } from "./SmartReviewPanel";

/**
 * Increment 4 — Report Check. The single "Review & Submit" surface.
 *
 * Consolidates three existing signals into one plain-language panel:
 *   🟢/🟡/🔴 readiness areas (structure, numbers, evidence, completeness, approval)
 *   ⚠️ Smart Review ("N things need your attention")
 *   the approve action (passed in, reusing the existing approval workflow)
 *
 * No new compliance system: readiness comes from CalculateReadinessHandler and
 * Smart Review from the existing gate.
 */

type CheckReadiness = {
  overall: number;
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
};

type AreaStatus = "good" | "attention" | "action";

function statusFor(score: number): AreaStatus {
  if (score >= 90) return "good";
  if (score >= 60) return "attention";
  return "action";
}

const STATUS_DOT: Record<AreaStatus, string> = { good: "🟢", attention: "🟡", action: "🔴" };
const STATUS_LABEL: Record<AreaStatus, string> = { good: "Ready", attention: "Needs attention", action: "Needs action" };

function Area({ label, score }: { label: string; score: number }) {
  const status = statusFor(score);
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mr-1.5">{STATUS_DOT[status]}</span>
        {label}
      </span>
      <span className={`text-xs ${status === "action" ? "text-red-600" : status === "attention" ? "text-amber-600" : "text-success-700 dark:text-success-400"}`}>
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

export function ReportCheckPanel({
  readiness,
  projectId,
  periodId,
  approval,
}: {
  readiness: CheckReadiness;
  projectId: string;
  periodId: string;
  approval?: ReactNode;
}) {
  const actionCount = [readiness.sectionsScore, readiness.indicatorsScore, readiness.evidenceScore, readiness.checklistScore, readiness.approvalScore].filter((s) => s < 60).length;

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Report Check</h3>
          {actionCount === 0 ? (
            <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-700 dark:text-success-400">Ready for approval</span>
          ) : (
            <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
              {actionCount} area{actionCount === 1 ? "" : "s"} need action
            </span>
          )}
        </div>
        <div className="space-y-2">
          <Area label="Required sections present" score={readiness.sectionsScore} />
          <Area label="Indicator figures verified" score={readiness.indicatorsScore} />
          <Area label="Supporting evidence" score={readiness.evidenceScore} />
          <Area label="Completeness" score={readiness.checklistScore} />
          <Area label="Approval" score={readiness.approvalScore} />
        </div>
      </div>

      <SmartReviewPanel projectId={projectId} periodId={periodId} />

      {approval && <div>{approval}</div>}
    </div>
  );
}
