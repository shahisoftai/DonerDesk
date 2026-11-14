import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { computeReportingSteps, type ReportingStepKey, type ReportingStepsInput } from "../application/reporting-steps";

const STEP: Record<ReportingStepKey, { label: string; next: string; path: string }> = {
  update: { label: "Inputs", next: "Enter and verify the values", path: "/inputs?tab=indicators" },
  story: { label: "Story", next: "Answer the story questions", path: "/inputs?tab=story" },
  generate: { label: "Draft", next: "Write the draft", path: "" },
  review: { label: "Review and export", next: "Review, approve and export", path: "/export" },
};
const ORDER: ReportingStepKey[] = ["update", "story", "generate", "review"];

/**
 * A report's four stages as one stepper with one "Next step" button (Version 4.000, plan F18/F19). The stage states are the
 * same rule the report pages already use (`computeReportingSteps`); every stage stays reachable.
 */
export function ReportStepper({ base, input }: { base: string; input: ReportingStepsInput }) {
  const steps = computeReportingSteps(input);
  const current = ORDER.find((k) => steps[k] === "current");
  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 py-3">
      <ol className="flex flex-wrap items-center gap-1" aria-label="Report stages">
        {ORDER.map((k, i) => (
          <li key={k} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="mx-1 h-px w-5 bg-slate-300 dark:bg-white/15" />}
            <Link
              href={base + STEP[k].path}
              aria-current={steps[k] === "current" ? "step" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium",
                steps[k] === "done" && "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10",
                steps[k] === "current" && "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-300/10 dark:text-brand-200 dark:ring-brand-300/20",
                steps[k] === "next" && "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5",
              )}
            >
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", steps[k] === "done" ? "bg-emerald-600 text-white" : steps[k] === "current" ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300")}>
                {steps[k] === "done" ? <Check aria-hidden="true" className="h-3 w-3" /> : i + 1}
              </span>
              {STEP[k].label}
            </Link>
          </li>
        ))}
      </ol>
      {current ? (
        <Link href={base + STEP[current].path} className="btn-primary">{STEP[current].next}<ArrowRight aria-hidden="true" className="rtl:rotate-180" /></Link>
      ) : (
        <span className="tag tag-green">Every stage is done</span>
      )}
    </div>
  );
}
