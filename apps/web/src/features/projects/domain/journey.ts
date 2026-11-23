/**
 * The project's journey (Phase 65): which stage the project is in and the one thing to do next. Pure: no React, no fetch, no clock
 * (facts arrive already read). The next step is the first rule in `NEXT_STEP_RULES` that applies, so the order of the table is the order
 * of importance; adding a rule is adding a row.
 */
import type { Checklist } from "./setup-checklist";

export interface JourneySource { title: string; href: string; urgent: boolean }

export interface JourneyFacts {
  projectId: string;
  /** What waits for the person on this project, most pressing first. */
  needsYou: readonly JourneySource[];
  checklist: Checklist | null;
  periods: number;
  canCreatePeriod: boolean;
  /** The next report's deadline in days from today; negative = late; null = no report due. */
  nextDeadlineDays: number | null;
  nextDeadlineTitle: string | null;
  /** Percent of the active period's readiness, when there is one. */
  readiness: number | null;
}

export interface NextStep { id: string; text: string; href: string; urgent: boolean; others: number; action: string }

export interface NextStepRule { id: string; applies: (f: JourneyFacts) => NextStep | null }

const at = (f: JourneyFacts, path: string) => `/projects/${f.projectId}${path}`;

/** Ordered: the first rule that applies wins. */
export const NEXT_STEP_RULES: readonly NextStepRule[] = [
  { id: "URGENT", applies: (f) => { const u = f.needsYou.find((i) => i.urgent); return u ? { id: "URGENT", text: u.title, href: u.href, urgent: true, others: f.needsYou.length - 1, action: "Open" } : null; } },
  { id: "ESSENTIAL_SETUP", applies: (f) => { const i = f.checklist?.items.find((x) => !x.done && x.forReport && ["indicators", "period"].includes(x.id)); return i ? { id: "ESSENTIAL_SETUP", text: i.title, href: at(f, i.path), urgent: false, others: 0, action: i.action } : null; } },
  { id: "NO_PERIOD", applies: (f) => (f.periods === 0 && f.canCreatePeriod ? { id: "NO_PERIOD", text: "Create the first reporting period to start recording values for a report.", href: at(f, "/periods"), urgent: false, others: 0, action: "Create a period" } : null) },
  { id: "REPORT_SOON", applies: (f) => (f.nextDeadlineDays !== null && f.nextDeadlineDays <= 14 && f.readiness !== null && f.readiness < 100 ? { id: "REPORT_SOON", text: `${f.nextDeadlineTitle ?? "The next report"} ${f.nextDeadlineDays < 0 ? "is late" : f.nextDeadlineDays === 0 ? "is due today" : `is due in ${f.nextDeadlineDays} days`} and is ${f.readiness}% ready.`, href: at(f, "/reports"), urgent: f.nextDeadlineDays < 0, others: 0, action: "Open reports" } : null) },
  { id: "WAITING", applies: (f) => { const u = f.needsYou[0]; return u ? { id: "WAITING", text: u.title, href: u.href, urgent: false, others: f.needsYou.length - 1, action: "Open" } : null; } },
  { id: "SETUP", applies: (f) => { const i = f.checklist?.items.find((x) => !x.done); return i ? { id: "SETUP", text: i.title, href: at(f, i.path), urgent: false, others: (f.checklist?.total ?? 0) - (f.checklist?.done ?? 0) - 1, action: i.action } : null; } },
];

export function nextStepFor(facts: JourneyFacts): NextStep | null {
  for (const rule of NEXT_STEP_RULES) { const step = rule.applies(facts); if (step) return step; }
  return null;
}

/** The stages of a project's life, in order, for the tracker. */
export const JOURNEY_STAGES = ["SET_UP", "PLAN", "COLLECT", "REVIEW", "REPORT"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Which stage the project is in, from what it has. */
export function journeyStage(f: { indicators: number; periods: number; reviewWaiting: boolean; reportUnderway: boolean }): JourneyStage {
  if (f.indicators === 0) return "SET_UP";
  if (f.periods === 0) return "PLAN";
  if (f.reportUnderway) return "REPORT";
  if (f.reviewWaiting) return "REVIEW";
  return "COLLECT";
}
