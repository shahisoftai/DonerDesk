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

export type NextStepKind = "enter-indicators" | "generate" | "review-statements" | "approve-sections" | "submit-review" | "approve-report";

export interface NextReportStep {
  kind: NextStepKind;
  label: string;
}

export interface NextStepsInput {
  unverifiedIndicatorCount: number;
  hasDraft: boolean;
  draftStatus?: string | null;
  /** Statements that failed verification and still wait for a decision. */
  pendingFailedClaims: number;
  sectionCount: number;
  approvedSectionCount: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What the person should do next, in order, in plain words. The first one is the single "do this now" button; the whole
 * list is the "what to do next" card. The page maps each kind to the place where it is done, so wording lives here once.
 */
export function nextReportSteps(input: NextStepsInput): NextReportStep[] {
  const steps: NextReportStep[] = [];
  if (input.unverifiedIndicatorCount > 0) {
    steps.push({ kind: "enter-indicators", label: `Enter and verify ${plural(input.unverifiedIndicatorCount, "indicator row", "indicator rows")}` });
  }
  if (!input.hasDraft) {
    steps.push({ kind: "generate", label: "Generate the AI draft" });
    return steps;
  }
  if (input.pendingFailedClaims > 0) {
    steps.push({ kind: "review-statements", label: `Review ${plural(input.pendingFailedClaims, "statement", "statements")} that need a decision` });
  }
  const remaining = input.sectionCount - input.approvedSectionCount;
  if (input.sectionCount > 0 && remaining > 0) {
    steps.push({ kind: "approve-sections", label: `Approve the remaining ${plural(remaining, "section", "sections")}` });
  }
  if (input.sectionCount > 0 && remaining === 0 && input.draftStatus === "DRAFT") {
    steps.push({ kind: "submit-review", label: "Submit the report for review" });
  }
  if (input.draftStatus === "UNDER_REVIEW") {
    steps.push({ kind: "approve-report", label: "Approve the report" });
  }
  return steps;
}
