"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ReportCheck } from "../../application/report-checks";

/** The one list of what is left before the report can be submitted. */
export function ChecksPanel({
  checks,
  busyId,
  onCheck,
  onBack,
  backLabel,
}: {
  checks: ReportCheck[];
  /** Check whose action is running (e.g. a re-check). */
  busyId: string | null;
  onCheck: (check: ReportCheck) => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const blocking = checks.filter((c) => c.severity === "BLOCKING").length;
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40">
      <div className="space-y-1 border-b border-slate-200 p-4 dark:border-white/10">
        {onBack && (
          <button type="button" onClick={onBack} className="min-h-[32px] text-sm text-brand-700 hover:underline dark:text-brand-300">
            ← {backLabel}
          </button>
        )}
        <h2 className="text-base font-semibold">Report checks</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          {checks.length === 0
            ? "Nothing left to fix."
            : blocking > 0
              ? `${blocking} thing${blocking === 1 ? "" : "s"} to finish before you can submit.`
              : "Only suggestions left — you can submit."}
        </p>
      </div>
      <ul className="space-y-2.5 p-4">
        {checks.length === 0 && (
          <li className="rounded-lg border border-success-500/30 bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400">
            Everything is in order.
          </li>
        )}
        {checks.map((check) => (
          <li key={check.id} className="flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${check.severity === "BLOCKING" ? "bg-warning-600" : "bg-slate-400"}`}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">
                <span className="sr-only">{check.severity === "BLOCKING" ? "Must fix: " : "Suggestion: "}</span>
                {check.title}
              </p>
              {check.detail && <p className="text-sm text-slate-600 dark:text-slate-300">{check.detail}</p>}
              {check.target.kind === "href" ? (
                <Link href={check.target.href} className="inline-block pt-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {check.actionLabel}
                </Link>
              ) : check.target.kind === "recheck" ? (
                <Button size="sm" variant="secondary" className="mt-1" pending={busyId === check.id} disabled={busyId !== null} onClick={() => onCheck(check)}>
                  {check.actionLabel}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCheck(check)}
                  className="min-h-[32px] pt-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  {check.actionLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
