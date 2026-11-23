import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { JOURNEY_STAGES, type JourneyStage, type NextStep } from "@/features/projects/domain/journey";
import type { Checklist } from "@/features/projects/domain/setup-checklist";
import { cn } from "@/components/ui/cn";

const STAGE_LABEL: Readonly<Record<JourneyStage, string>> = { SET_UP: "Set up", PLAN: "Plan", COLLECT: "Collect", REVIEW: "Review", REPORT: "Report" };

/**
 * The project's home in one card (Phase 65): where the project is in its life and the one thing to do next. Replaces the lifecycle
 * strip, the next-step strip and the "set up your reporting period" card. It reads; the button is a link to the screen that owns the work.
 */
export function ProjectJourney({ stage, step, checklist, checklistHref }: { stage: JourneyStage; step: NextStep | null; checklist: Checklist | null; checklistHref: string }) {
  const at = JOURNEY_STAGES.indexOf(stage);
  return (
    <section aria-label="Where this project is" data-tour-id="project-journey" className="card">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {JOURNEY_STAGES.map((s, i) => (
          <li key={s} aria-current={i === at ? "step" : undefined} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", i === at ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-300/10 dark:text-brand-200 dark:ring-brand-300/20" : i < at ? "text-slate-700 dark:text-slate-200" : "")}>
            {i < at ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {STAGE_LABEL[s]}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Do this next</p>
          <p className={cn("mt-1 text-[15px] font-medium", step?.urgent ? "text-danger-700 dark:text-danger-400" : "text-slate-900 dark:text-white")}>
            {step ? step.text : "You are up to date. Nothing is waiting for you."}
          </p>
          {step && step.others > 0 ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{step.others} more after this one.</p> : null}
        </div>
        {step ? <Link href={step.href} className="btn inline-flex shrink-0 items-center gap-1">{step.action} <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link> : null}
      </div>
      {checklist && !checklist.complete ? (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>Setup checklist: {checklist.done} of {checklist.total} done</span>
            <Link href={checklistHref} className="font-medium text-brand-700 hover:underline dark:text-brand-300">See the checklist</Link>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={checklist.total} aria-valuenow={checklist.done} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand-600 dark:bg-brand-300" style={{ width: `${checklist.total === 0 ? 0 : Math.round((checklist.done / checklist.total) * 100)}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
