import Link from "next/link";
import { cn } from "@/components/ui/cn";
import type { ReportingStepKey, StepState } from "../application/reporting-steps";

/**
 * The Reporting Period Workspace, framed as the 4 jobs a user actually does:
 *  ① Update Project  → enter what happened (indicators, activities, evidence)
 *  ② Tell the Story  → challenges / changes / lessons that numbers can't explain
 *  ③ Generate        → let AI write the report
 *  ④ Review & Submit → read, fix only what matters, approve and export
 *
 * Step states come from `computeReportingSteps` (real period data). Step ①
 * links to the indicator entry page; the other steps live on this page, so
 * they call `onSelect` to reveal the matching panel instead of reloading it.
 */
export function ReportingStepGuide({
  projectId,
  periodId,
  states,
  onSelect,
}: {
  projectId: string;
  periodId: string;
  states: Record<ReportingStepKey, StepState>;
  onSelect: (step: Exclude<ReportingStepKey, "update">) => void;
}) {
  const steps: Array<{ key: ReportingStepKey; n: string; label: string; hint: string }> = [
    { key: "update", n: "1", label: "Update Project", hint: "Indicators, activities and evidence" },
    { key: "story", n: "2", label: "Tell the Story", hint: "Challenges, changes and lessons" },
    { key: "generate", n: "3", label: "Generate Draft", hint: "AI writes the report from your inputs" },
    { key: "review", n: "4", label: "Review & Submit", hint: "Read, fix only what matters, approve and export" },
  ];

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      {steps.map((step) => {
        const state = states[step.key];
        const className = cn(
          "flex h-full w-full items-start gap-2.5 rounded-lg border p-3 text-left transition",
          state === "current"
            ? "border-brand-500/40 bg-brand-500/5"
            : "border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-700",
        );
        const body = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                state === "current"
                  ? "bg-brand-500 text-white"
                  : state === "done"
                    ? "bg-success-500/15 text-success-700 dark:text-success-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {state === "done" ? "✓" : step.n}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                {step.label}
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.hint}</span>
            </span>
          </>
        );
        return (
          <li key={step.key}>
            {step.key === "update" ? (
              <Link href={`/projects/${projectId}/reports/${periodId}/indicators`} className={className} aria-current={state === "current" ? "step" : undefined}>
                {body}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(step.key as Exclude<ReportingStepKey, "update">)}
                className={className}
                aria-current={state === "current" ? "step" : undefined}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
