import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NextStep } from "@/features/projects/domain/next-step";

/** One line at the top of the Overview: the next thing for this person, one button, and how many more wait in the list below. */
export function NextStepStrip({ step }: { step: NextStep | null }) {
  if (!step) return null;
  return (
    <section aria-label="What is next" data-testid="next-step" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-900/20">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{step.urgent ? "Next, and late: " : "Next: "}</span>{step.text}
        {step.others > 0 ? <span className="text-slate-600 dark:text-slate-300"> · {step.others} more below</span> : null}
      </p>
      <Link className="btn inline-flex items-center gap-1" href={step.href}>{step.action === "CREATE_PERIOD" ? "Create period" : "Open"}<ArrowRight aria-hidden className="h-4 w-4 rtl:-scale-x-100" /></Link>
    </section>
  );
}
