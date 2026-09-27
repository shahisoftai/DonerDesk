"use client";

const RADIUS = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Progress ring + "n to do". Opens the Report checks panel. */
export function ReadinessButton({
  percent,
  todo,
  expanded,
  onClick,
}: {
  percent: number;
  todo: number;
  expanded: boolean;
  onClick: () => void;
}) {
  const ringClass = percent >= 95 ? "stroke-success-600" : percent >= 50 ? "stroke-brand-500" : "stroke-warning-600";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`Report checks: ${percent}% ready, ${todo === 0 ? "nothing" : todo} to do`}
      className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1.5 pr-3 text-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-white/5"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90" aria-hidden="true">
        <circle cx="14" cy="14" r={RADIUS} fill="none" strokeWidth="3" className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx="14"
          cy="14"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={ringClass}
          strokeDasharray={`${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`}
        />
      </svg>
      <span className="font-semibold">{percent}% ready</span>
      <span className="hidden text-slate-500 dark:text-slate-400 sm:inline">· {todo === 0 ? "all done" : `${todo} to do`}</span>
    </button>
  );
}
