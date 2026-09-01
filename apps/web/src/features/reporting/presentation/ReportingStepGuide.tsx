import Link from "next/link";
import { cn } from "@/components/ui/cn";

type StepState = "done" | "current" | "next";

/**
 * The Reporting Period Workspace, framed as the 4 jobs a user actually does:
 *  ① Update Project  → enter what happened (indicators, activities, evidence)
 *  ② Tell the Story  → challenges / changes / lessons that numbers can't explain
 *  ③ Generate        → let AI write the report
 *  ④ Review & Submit → read, fix only what matters, approve and export
 *
 * This is a progressive-disclosure surface: the heavy assurance machinery that
 * powers steps ③ and ④ stays in the background. Steps ① and ② reuse the
 * existing period-scoped input routes.
 */
export function ReportingStepGuide({
  projectId,
  periodId,
  hasDraft,
}: {
  projectId: string;
  periodId: string;
  hasDraft: boolean;
}) {
  const steps: Array<{ n: string; label: string; hint: string; href: string; state: StepState }> = [
    {
      n: "1",
      label: "Update Project",
      hint: "Indicators, activities and evidence",
      href: `/projects/${projectId}/reports/${periodId}/indicators`,
      state: "done",
    },
    {
      n: "2",
      label: "Tell the Story",
      hint: "Challenges, changes and lessons",
      href: `/projects/${projectId}/reports/${periodId}`,
      state: "next",
    },
    {
      n: "3",
      label: "Generate Draft",
      hint: "AI writes the report from your inputs",
      href: `/projects/${projectId}/reports/${periodId}`,
      state: hasDraft ? "done" : "current",
    },
    {
      n: "4",
      label: "Review & Submit",
      hint: "Read, fix only what matters, approve and export",
      href: `/projects/${projectId}/reports/${periodId}`,
      state: hasDraft ? "current" : "next",
    },
  ];

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      {steps.map((step) => (
        <li key={step.n}>
          <Link
            href={step.href}
            className={cn(
              "flex h-full items-start gap-2.5 rounded-lg border p-3 text-left transition",
              step.state === "current"
                ? "border-brand-500/40 bg-brand-500/5"
                : "border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-700",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step.state === "current"
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {step.n}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{step.label}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{step.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
