/** The editor's first-run tour (Phase 48.18): a short list of steps shown once per device. Each step is a key into the four-language catalogue. */
export const TOUR_STEPS = ["add", "move", "look", "commands", "share"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];
export const TOUR_STORAGE_KEY = "dd-canvas-tour-v1";

/** Whether the tour has been finished or skipped on this device. A storage that cannot be read counts as seen: a tour must never nag. */
export function tourSeen(read: () => string | null): boolean {
  try { return read() === "done"; } catch { return true; }
}

/** The step after `step`, or null at the end. */
export const nextTourStep = (step: TourStep): TourStep | null => TOUR_STEPS[TOUR_STEPS.indexOf(step) + 1] ?? null;
export const previousTourStep = (step: TourStep): TourStep | null => TOUR_STEPS[TOUR_STEPS.indexOf(step) - 1] ?? null;
