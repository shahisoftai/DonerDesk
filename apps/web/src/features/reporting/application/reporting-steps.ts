/**
 * Real progress for the four-step reporting guide. Previously the steps were
 * hard-coded (step 1 always "done", step 2 always "next"); each step's state
 * is now derived from the period's actual data. Pure module for unit tests.
 */

export type StepState = "done" | "current" | "next";

export type ReportingStepsInput = {
  /** Indicator rows for the period. */
  indicatorCount: number;
  /** Indicator rows still missing a verified value. */
  unverifiedIndicatorCount: number;
  /** Story questions answered (non-empty). */
  storyAnswered: number;
  hasDraft: boolean;
  /** Draft status: DRAFT | UNDER_REVIEW | APPROVED | EXPORTED | SUBMITTED. */
  draftStatus?: string | null;
};

export type ReportingStepKey = "update" | "story" | "generate" | "review";

export function computeReportingSteps(input: ReportingStepsInput): Record<ReportingStepKey, StepState> {
  const updateDone = input.indicatorCount > 0 && input.unverifiedIndicatorCount === 0;
  const storyDone = input.storyAnswered > 0;
  const generateDone = input.hasDraft;
  const reviewDone = Boolean(input.draftStatus && input.draftStatus !== "DRAFT");

  const done: Record<ReportingStepKey, boolean> = {
    update: updateDone,
    story: storyDone,
    generate: generateDone,
    review: reviewDone,
  };

  // "Current" is the first unfinished step; a user may still skip ahead, so
  // later steps stay "next" rather than locked.
  const order: ReportingStepKey[] = ["update", "story", "generate", "review"];
  const current = order.find((k) => !done[k]);
  const out = {} as Record<ReportingStepKey, StepState>;
  for (const key of order) out[key] = done[key] ? "done" : key === current ? "current" : "next";
  return out;
}

/** Story questions the "Tell the Story" panel asks (keys of the period's storyContext). */
export const STORY_KEYS = ["achievements", "challenges", "varianceExplanations", "adaptations", "lessons"] as const;

/** Number of story questions with a non-blank answer. */
export function countStoryAnswers(story: Partial<Record<(typeof STORY_KEYS)[number], string | undefined>> | undefined | null): number {
  if (!story) return 0;
  return STORY_KEYS.filter((key) => (story[key] ?? "").trim().length > 0).length;
}
