/**
 * "Which planned activity is this?" on the completed-activity form: up to three open planned activities, ranked
 * (the person's own first, then the same logframe activity, then by planned date nearest the activity's date),
 * each with the reasons it was suggested. "None of these" is always offered by the form.
 */
import { compareDates, daysBetween, formatShortDate, type PlainDate } from "./plain-date.js";
import { isOpenPlanStatus, type PlanStatus } from "./plan-status-transitions.js";
import { WORKPLAN_COPY } from "./workplan-copy.js";

export interface LinkCandidate {
  id: string;
  status: PlanStatus;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  logframeActivityId?: string;
  ownerUserId?: string;
  supportUserIds?: ReadonlyArray<string>;
}

export interface LinkQuery {
  userId: string;
  date: PlainDate;
  logframeActivityId?: string;
}

export interface PlanLinkSuggestion {
  id: string;
  reasons: string[];
}

export const MAX_PLAN_LINK_SUGGESTIONS = 3;

function distance(c: LinkCandidate, date: PlainDate): number {
  if (compareDates(date, c.plannedStart) < 0) return daysBetween(date, c.plannedStart);
  if (compareDates(date, c.plannedEnd) > 0) return daysBetween(c.plannedEnd, date);
  return 0;
}

export function suggestPlanLinks(query: LinkQuery, candidates: ReadonlyArray<LinkCandidate>, limit = MAX_PLAN_LINK_SUGGESTIONS): PlanLinkSuggestion[] {
  return candidates
    .filter((c) => isOpenPlanStatus(c.status))
    .map((c) => {
      const mine = c.ownerUserId === query.userId || (c.supportUserIds ?? []).includes(query.userId);
      const sameNode = query.logframeActivityId !== undefined && c.logframeActivityId === query.logframeActivityId;
      const reasons: string[] = [];
      if (mine) reasons.push(WORKPLAN_COPY.linkYouLead);
      if (sameNode) reasons.push(WORKPLAN_COPY.linkSameLogframe);
      const dates = c.plannedStart === c.plannedEnd ? formatShortDate(c.plannedStart, query.date) : `${formatShortDate(c.plannedStart, query.date)} to ${formatShortDate(c.plannedEnd, query.date)}`;
      reasons.push(`${WORKPLAN_COPY.linkPlannedFor} ${dates}`);
      return { id: c.id, reasons, rank: [mine ? 0 : 1, sameNode ? 0 : 1, distance(c, query.date)] as const };
    })
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, reasons }) => ({ id, reasons }));
}
