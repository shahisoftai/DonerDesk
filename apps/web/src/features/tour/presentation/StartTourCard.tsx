"use client";

import { useStartOrResumeTour } from "./useStartOrResumeTour";

/**
 * Compact entry point for the DonorDesk Academy guided tour (Feature 22),
 * placed in the project setup page's storage/workspace aside. Creates (or
 * reuses) the tenant's demo project, then starts the tour and navigates to
 * it.
 */
export function StartTourCard({ hasExistingDemoProject = false }: { hasExistingDemoProject?: boolean }) {
  const { startOrResumeTour, pending, error } = useStartOrResumeTour();

  return (
    <section className="card" data-tour-id="start-tour-card">
      <h3 className="font-medium">{hasExistingDemoProject ? "Continue learning DonorDesk" : "New to DonorDesk?"}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {hasExistingDemoProject
          ? "Jump back into your sample project and pick up the guided tour where you left off."
          : "Take a 10–15 minute guided tour through a sample project — from setup to a finished, exported report."}
      </p>
      {error ? <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p> : null}
      <button
        type="button"
        onClick={startOrResumeTour}
        disabled={pending}
        className="btn-secondary mt-3 text-sm disabled:opacity-60"
      >
        {pending ? "Setting up..." : hasExistingDemoProject ? "Resume the product tour" : "Start the product tour"}
      </button>
    </section>
  );
}
