"use client";

import { useStartOrResumeTour } from "./useStartOrResumeTour";

/**
 * Persistent "Academy" entry point in the app header (Feature 22). Unlike a
 * plain link to the dashboard — which does nothing visible when the user is
 * already there — this directly creates-or-resumes the demo project and
 * starts the tour from wherever in the app it's clicked.
 */
export function AcademyHeaderButton() {
  const { startOrResumeTour, pending } = useStartOrResumeTour();

  return (
    <button
      type="button"
      onClick={startOrResumeTour}
      disabled={pending}
      className="hidden items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 sm:flex dark:border-white/15 dark:text-slate-300"
    >
      {pending ? "Loading..." : "Academy"}
    </button>
  );
}
