/**
 * Every user-visible word of the work plan comes from here (one word per thing, plan §1a rule 2): a *planned
 * activity* is the work planned ahead, a *completed activity* is the entry made after doing it, a *request* is one
 * person asking another, a *milestone* is a planned activity with one date. A copy test scans every string below
 * with `findRawTokens` and `findForbiddenWorkplanTerms`.
 */
import type { PlanStatus } from "./plan-status-transitions.js";

export const WORKPLAN_TERMS = {
  planned: { one: "planned activity", many: "planned activities" },
  completed: { one: "completed activity", many: "completed activities" },
  request: { one: "request", many: "requests" },
  milestone: { one: "milestone", many: "milestones" },
} as const;

/** What a person sees for a stored status (the three-step control plus Cancelled from the menu). */
export const PLAN_STATUS_LABEL: Readonly<Record<PlanStatus, string>> = {
  PLANNED: "Not started",
  IN_PROGRESS: "Under way",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const WORKPLAN_COPY = {
  tabPlanned: "Planned",
  tabCompleted: "Completed",
  emptyCardTitle: "Plan your activities (optional)",
  emptyCardBody: "See what is due and late.",
  startFromLogframe: "Start from my logframe",
  importSheet: "Import a sheet",
  notNow: "Not now",
  addPlanned: "Add planned activity",
  addCompleted: "Add completed activity",
  askForCompleted: "Ask for completed activity",
  askForFile: "Ask for a file",
  markDoneQuestion: "Mark activity done?",
  movedFrom: "moved from",
  whyMoved: "Why?",
  onlyThisOne: "Only this one",
  thisAndLater: "This and later ones",
  whichPlanned: "Which planned activity is this?",
  noneOfThese: "None of these",
  showWorkPlanning: "Show work planning",
  linkYouLead: "You lead it",
  linkSameLogframe: "Same logframe activity",
  linkPlannedFor: "Planned for",
} as const;

/**
 * Words the work plan must not use: internal names ("baseline", "delivery state", "series", "assignment",
 * "subject", "task kind") and "record" for an entry (the entry is a completed activity).
 */
export const FORBIDDEN_WORKPLAN_TERMS: ReadonlyArray<{ term: string; pattern: RegExp }> = [
  { term: "record", pattern: /\brecords?\b/i },
  { term: "baseline", pattern: /\bbaselines?\b/i },
  { term: "delivery state", pattern: /\bdelivery states?\b/i },
  { term: "series", pattern: /\bseries\b/i },
  { term: "assignment", pattern: /\bassignments?\b/i },
  { term: "subject", pattern: /\bsubjects?\b/i },
  { term: "task kind", pattern: /\btask kinds?\b/i },
];

export function findForbiddenWorkplanTerms(text: string): string[] {
  return FORBIDDEN_WORKPLAN_TERMS.filter((t) => t.pattern.test(text)).map((t) => t.term);
}

/** Every static string above, for the copy test. */
export function allWorkplanCopy(): string[] {
  return [
    ...Object.values(WORKPLAN_TERMS).flatMap((t) => [t.one, t.many]),
    ...Object.values(PLAN_STATUS_LABEL),
    ...Object.values(WORKPLAN_COPY),
  ];
}
