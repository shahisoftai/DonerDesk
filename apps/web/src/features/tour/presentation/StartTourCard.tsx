"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDemoProjectAction } from "@/lib/actions/demo-project";
import { useTourProgress } from "./useTourProgress";
import { useToast } from "@/components/feedback/Toast";

/**
 * Dashboard entry point for the DonorDesk Academy guided tour (Feature 22).
 * Creates (or reuses) the tenant's demo project, then starts the tour and
 * navigates to it.
 */
export function StartTourCard({ hasExistingDemoProject = false }: { hasExistingDemoProject?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { start } = useTourProgress();
  const router = useRouter();
  const toast = useToast();

  const onStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await createDemoProjectAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.value.reused) {
        toast.push({ title: "Resuming your demo project", tone: "info" });
      }
      start();
      router.push(`/projects/${result.value.id}`);
    });
  };

  return (
    <div
      data-tour-id="start-tour-card"
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-800"
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {hasExistingDemoProject ? "Continue learning DonorDesk" : "New to DonorDesk?"}
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {hasExistingDemoProject
          ? "Jump back into your sample project and pick up the guided tour where you left off."
          : "Take a 10–15 minute guided tour through a sample project — from setup to a finished, exported report."}
      </p>
      {error ? <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p> : null}
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Setting up..." : hasExistingDemoProject ? "Resume the product tour" : "Start the product tour"}
      </button>
    </div>
  );
}
