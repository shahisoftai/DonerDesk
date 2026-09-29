"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "donordesk.academy.tour.v1";
const SYNC_EVENT = "donordesk:academy-tour-progress";

type TourProgress = {
  active: boolean;
  currentStepIndex: number;
  completedStepIds: string[];
  dismissedAt?: string;
};

const DEFAULT_PROGRESS: TourProgress = { active: false, currentStepIndex: 0, completedStepIds: [] };

function readProgress(): TourProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PROGRESS, ...(JSON.parse(raw) as Partial<TourProgress>) } : DEFAULT_PROGRESS;
  } catch {
    // localStorage can throw in private browsing / blocked contexts; fall back to defaults.
    return DEFAULT_PROGRESS;
  }
}

/**
 * Tour progress is a per-viewer UI convenience (which step you're on, whether
 * you dismissed the tour), not shared business state, so it lives in
 * `localStorage` rather than a new backend table — consistent with how this
 * app already treats other lightweight, per-browser UI preferences.
 *
 * `StartTourCard` and `TourOverlay` each call this hook independently, and
 * the App Router keeps `TourOverlay` mounted across client-side navigations
 * (it lives in the portal layout), so a write from one instance would
 * otherwise never reach the other's React state until a full page reload —
 * the `storage` event doesn't fire in the same tab that made the write. A
 * same-tab custom event closes that gap: every write dispatches it, and
 * every instance re-reads localStorage when it fires.
 */
export function useTourProgress() {
  const [progress, setProgress] = useState<TourProgress>(DEFAULT_PROGRESS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
    setHydrated(true);
    const onSync = () => setProgress(readProgress());
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  const persist = useCallback((next: TourProgress) => {
    setProgress(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {
      // Best-effort only; the tour still works in-memory for this session.
    }
  }, []);

  const start = useCallback(() => persist({ ...readProgress(), active: true, currentStepIndex: 0 }), [persist]);

  const stop = useCallback(
    () => persist({ ...readProgress(), active: false, dismissedAt: new Date().toISOString() }),
    [persist],
  );

  const goToStep = useCallback((index: number) => persist({ ...readProgress(), currentStepIndex: index }), [persist]);

  const completeStep = useCallback(
    (stepId: string) => {
      const current = readProgress();
      persist({
        ...current,
        completedStepIds: current.completedStepIds.includes(stepId)
          ? current.completedStepIds
          : [...current.completedStepIds, stepId],
      });
    },
    [persist],
  );

  return { progress, hydrated, start, stop, goToStep, completeStep };
}
