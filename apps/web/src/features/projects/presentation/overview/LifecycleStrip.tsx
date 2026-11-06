import type { Lifecycle } from "@/features/projects/domain/overview-derive";

/**
 * Where the project stands in its life: set up, in implementation, or closing. The strip is always
 * shown — it is the frame the rest of the page sits in — and it says how many reporting periods the
 * programme has and which one it is in.
 */
export function LifecycleStrip({ life }: { life: Lifecycle }) {
  const stage = stageCopy(life);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Project lifecycle">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success-500/25 bg-success-500/10 px-3 py-1 text-xs font-medium text-success-700 dark:text-success-400">
        ✓ Set up
      </span>
      <span className="text-[11px] text-slate-400">→</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
        {stage.label}
      </span>
      <span className="text-[11px] text-slate-400">→</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/60 px-3 py-1 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300">
        {stage.next}
      </span>
      {life.totalPeriods > 0 ? (
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {life.currentPeriod} of {life.totalPeriods} {life.periodUnit}s
        </span>
      ) : null}
    </div>
  );
}

function stageCopy(life: Lifecycle): { label: string; next: string } {
  switch (life.stage) {
    case "SETUP":
      return { label: "Not started yet", next: "Implementation" };
    case "ENDED":
      return { label: "Finished", next: "Closed" };
    case "CLOSEOUT":
      return { label: "In implementation · closing ahead", next: "Closed" };
    case "IMPLEMENTATION":
      return { label: "In implementation", next: "Close-out" };
  }
}
