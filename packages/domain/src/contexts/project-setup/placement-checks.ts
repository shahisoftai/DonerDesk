/**
 * Placement checks (Phase 37.5): advice, never a block, about where the proposed items will land — a chain with two goals or
 * a missing level, indicators and planned activities that no result holds yet, and project dates the documents leave out
 * although the work plan states its span. Each problem names a count or the values the sentence needs; the screen
 * translates from the code. Pure.
 */
import { compareDates, isPlainDate } from "../workplan/plain-date.js";
import { LEVEL_RANK } from "./results-chain.js";
import type { ProjectSetupProposal, Proposed, SetupLogLevel } from "./proposal.js";
import type { SetupProblem } from "./proposal-checks.js";

const live = <T>(item: Proposed<T>): boolean => item.status !== "REJECTED" && item.value !== null;

const LEVELS: readonly SetupLogLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export function checkResultsChain(proposal: ProjectSetupProposal): SetupProblem[] {
  const nodes = proposal.logframe.filter(live);
  if (nodes.length === 0) return [];
  const problems: SetupProblem[] = [];
  const goals = nodes.filter((n) => n.value!.level === "GOAL").length;
  if (goals > 1) {
    problems.push({ code: "LOGFRAME_SEVERAL_GOALS", path: "logframe", severity: "SOFT", message: `The results chain has ${goals} goals; a project usually has one.`, params: { count: goals } });
  }
  const present = new Set(nodes.map((n) => n.value!.level));
  const deepest = Math.max(...[...present].map((l) => LEVEL_RANK[l]));
  for (const level of LEVELS) {
    if (LEVEL_RANK[level] < deepest && !present.has(level)) {
      problems.push({ code: "LOGFRAME_LEVEL_MISSING", path: "logframe", severity: "SOFT", message: `The results chain has no ${level.toLowerCase()} although it has items below that level.`, params: { level } });
    }
  }
  return problems;
}

function unplaced(items: ReadonlyArray<Proposed<{ logframeCode: string | null }>>): number {
  return items.filter((i) => live(i) && !i.value!.logframeCode).length;
}

export function checkPlacement(proposal: ProjectSetupProposal): SetupProblem[] {
  if (!proposal.logframe.some(live)) return [];
  const problems: SetupProblem[] = [];
  const indicators = unplaced(proposal.indicators);
  if (indicators > 0) {
    problems.push({ code: "INDICATORS_NOT_PLACED", path: "indicators", severity: "SOFT", message: `${indicators} indicator(s) are not under a result yet: choose one for each.`, params: { count: indicators } });
  }
  const activities = unplaced(proposal.plan);
  if (activities > 0) {
    problems.push({ code: "ACTIVITIES_NOT_PLACED", path: "plan", severity: "SOFT", message: `${activities} planned activit(ies) are not under a result yet.`, params: { count: activities } });
  }
  return problems;
}

/** The work plan's own span, when the project's dates are not stated: the person can take them from it. */
export function checkDatesFromPlan(proposal: ProjectSetupProposal): SetupProblem[] {
  const { startDate, endDate } = proposal.facts;
  const missingStart = startDate.value === null;
  const missingEnd = endDate.value === null;
  if (!missingStart && !missingEnd) return [];
  const days = proposal.plan.filter(live).flatMap((a) => [a.value!.start, a.value!.end]).filter((d): d is string => !!d && isPlainDate(d)).sort(compareDates);
  if (days.length === 0) return [];
  return [{
    code: "FACTS_DATES_FROM_PLAN", path: missingStart ? "facts.startDate" : "facts.endDate", severity: "SOFT",
    message: `The documents do not state the project's ${missingStart && missingEnd ? "dates" : missingStart ? "start" : "end"}; the work plan runs from ${days[0]} to ${days[days.length - 1]}.`,
    params: { start: days[0]!, end: days[days.length - 1]! },
  }];
}
