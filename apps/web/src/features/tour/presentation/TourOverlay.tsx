"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TOUR_STEPS } from "../domain/tour-steps";
import { useTourProgress } from "./useTourProgress";

/**
 * Spotlight/tooltip overlay for the DonorDesk Academy guided tour (Feature
 * 22). Mounted once in the portal layout so it survives route changes as the
 * tour walks the user across screens. A step whose `[data-tour-id]` target
 * isn't present on the current page (wrong route, hidden by permissions) is
 * skipped rather than rendered floating with nothing to point at.
 */
export function TourOverlay() {
  const { progress, hydrated, stop, goToStep, completeStep } = useTourProgress();
  const router = useRouter();
  const pathname = usePathname();
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Derived from the current URL (`/projects/{id}/...`, `/reports/{periodId}/...`)
  // rather than passed down, since the tour overlay is mounted once at the
  // portal root and must work across every nested route it walks.
  const projectId = pathname.match(/\/projects\/([^/]+)/)?.[1];
  const periodId = pathname.match(/\/reports\/([^/]+)/)?.[1];

  const step = TOUR_STEPS[progress.currentStepIndex];

  const missingContext = Boolean(step && ((step.route.includes("{projectId}") && !projectId) || (step.route.includes("{periodId}") && !periodId)));

  useEffect(() => {
    if (!hydrated || !progress.active || !step) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [hydrated, progress.active, progress.currentStepIndex, step, pathname]);

  if (!hydrated || !progress.active || !step) return null;

  const isLast = progress.currentStepIndex === TOUR_STEPS.length - 1;

  const advance = () => {
    completeStep(step.id);
    if (isLast) {
      stop();
      return;
    }
    const next = TOUR_STEPS[progress.currentStepIndex + 1];
    goToStep(progress.currentStepIndex + 1);
    if (!next) return;
    const nextRoute = next.route.replace("{projectId}", projectId ?? "").replace("{periodId}", periodId ?? "");
    if (nextRoute !== pathname && !nextRoute.includes("{")) router.push(nextRoute);
  };

  const skip = () => {
    if (!step.optional) {
      advance();
      return;
    }
    completeStep(step.id);
    if (isLast) return stop();
    goToStep(progress.currentStepIndex + 1);
  };

  if (missingContext) {
    // The tour needs a project/period id it doesn't have yet (e.g. the user
    // hasn't created the demo project). Nothing to anchor to — stay hidden.
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand-500 ring-offset-2 ring-offset-transparent transition-all"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      ) : null}
      <div
        className="pointer-events-auto fixed bottom-6 right-6 w-80 rounded-xl border border-slate-300 bg-white p-4 shadow-lg dark:border-white/15 dark:bg-slate-800"
        role="dialog"
        aria-label="DonorDesk Academy guided tour"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Step {progress.currentStepIndex + 1} of {TOUR_STEPS.length}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={stop}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            End tour
          </button>
          <div className="flex gap-2">
            {step.optional ? (
              <button
                type="button"
                onClick={skip}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Skip
              </button>
            ) : null}
            <button
              type="button"
              onClick={advance}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
