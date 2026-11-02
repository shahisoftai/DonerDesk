import type { SetupDraft } from "./draft.js";
import { incompletePlans, uncoveredActivities, unfedIndicators } from "./requirements/places-plan.js";
import { live } from "./requirements/shared.js";

export interface PlanCoverage {
  /** Logframe activities that have planned work. */
  activities: { covered: number; total: number };
  /** Planned activities with dates, a place (or "project-wide") and a lead. */
  plans: { complete: number; total: number };
  /** Indicators fed by an activity or collected by their own method. */
  indicators: { fed: number; total: number };
}

/** The numbers behind the work plan's coverage bar; the same predicates the requirements use, so the bar and the inbox never disagree. */
export function planCoverage(draft: SetupDraft): PlanCoverage {
  const activities = live(draft.proposal.logframe).filter((n) => n.level === "ACTIVITY").length;
  const plans = live(draft.proposal.plan).length;
  const indicators = live(draft.proposal.indicators).length;
  return {
    activities: { covered: activities - uncoveredActivities(draft).length, total: activities },
    plans: { complete: plans - incompletePlans(draft).length, total: plans },
    indicators: { fed: indicators - unfedIndicators(draft).length, total: indicators },
  };
}
