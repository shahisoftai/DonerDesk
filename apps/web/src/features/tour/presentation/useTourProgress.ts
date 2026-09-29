"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "donordesk.academy.tour.v1";

type TourProgress = {
  active: boolean;
  currentStepIndex: number;
  completedStepIds: string[];
  dismissedAt?: string;
};

const DEFAULT_PROGRESS: TourProgress = { active: false, currentStepIndex: 0, completedStepIds: [] };

/**
 * Tour progress is a per-viewer UI convenience (which step you're on, whether
 * you dismissed the tour), not shared business state, so it lives in
 * `localStorage` rather than a new backend table — consistent with how this
 * app already treats other lightweight, per-browser UI preferences.
 */
export function useTourProgress() {
  const [progress, setProgress] = useState<TourProgress>(DEFAULT_PROGRESS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setProgress({ ...DEFAULT_PROGRESS, ...(JSON.parse(raw) as Partial<TourProgress>) });
    } catch {
      // localStorage can throw in private browsing / blocked contexts; fall back to defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = useCallback((next: TourProgress) => {
    setProgress(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort only; the tour still works in-memory for this session.
    }
  }, []);

  const start = useCallback(() => persist({ ...progress, active: true, currentStepIndex: 0 }), [progress, persist]);

  const stop = useCallback(
    () => persist({ ...progress, active: false, dismissedAt: new Date().toISOString() }),
    [progress, persist],
  );

  const goToStep = useCallback((index: number) => persist({ ...progress, currentStepIndex: index }), [progress, persist]);

  const completeStep = useCallback(
    (stepId: string) =>
      persist({
        ...progress,
        completedStepIds: progress.completedStepIds.includes(stepId)
          ? progress.completedStepIds
          : [...progress.completedStepIds, stepId],
      }),
    [progress, persist],
  );

  return { progress, hydrated, start, stop, goToStep, completeStep };
}
