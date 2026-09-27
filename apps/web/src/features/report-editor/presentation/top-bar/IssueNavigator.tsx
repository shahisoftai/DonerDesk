"use client";

/**
 * "‹ 2 of 5 issues ›" (Report Editor U5): steps through statements that need
 * a decision and sections that need a re-check, in document order. Keyboard:
 * `n` / `Shift+N` (see shortcuts).
 */
export function IssueNavigator({ position, total, onPrev, onNext }: { position: number; total: number; onPrev: () => void; onNext: () => void }) {
  if (total === 0) return null;
  const label = position > 0 ? `${position} of ${total}` : `${total}`;
  return (
    <div role="group" aria-label="Issues" className="flex h-10 items-center rounded-lg border border-slate-200 dark:border-white/10">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous issue"
        title="Previous issue (Shift+N)"
        className="flex h-full w-9 items-center justify-center rounded-l-lg text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span className="whitespace-nowrap px-1.5 text-sm tabular-nums text-slate-700 dark:text-slate-200" aria-live="polite">
        {label} <span className="hidden sm:inline">{total === 1 ? "issue" : "issues"}</span>
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next issue"
        title="Next issue (N)"
        className="flex h-full w-9 items-center justify-center rounded-r-lg text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
