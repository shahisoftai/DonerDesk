/**
 * "Which planned activity is this?" on the completed-activity form: up to three open planned activities, ranked
 * (the person's own first, then the same logframe activity, then the one whose title the typed title repeats, then by planned
 * date nearest the activity's date),
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
  title?: string;
  ownerUserId?: string;
  supportUserIds?: ReadonlyArray<string>;
}

export interface LinkQuery {
  userId: string;
  date: PlainDate;
  logframeActivityId?: string;
  /** What the person has typed so far: a planned activity whose title it repeats is offered before others. */
  title?: string;
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

const words = (t: string): string => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The typed title contains the planned activity's whole title (a person copying or extending it). */
function titleRepeats(typed: string | undefined, planned: string | undefined): boolean {
  const a = typed ? words(typed) : "";
  const b = planned ? words(planned) : "";
  return a.length >= 4 && b.length >= 4 && a.includes(b);
}

export function suggestPlanLinks(query: LinkQuery, candidates: ReadonlyArray<LinkCandidate>, limit = MAX_PLAN_LINK_SUGGESTIONS): PlanLinkSuggestion[] {
  return candidates
    .filter((c) => isOpenPlanStatus(c.status))
    .map((c) => {
      const mine = c.ownerUserId === query.userId || (c.supportUserIds ?? []).includes(query.userId);
      const sameNode = query.logframeActivityId !== undefined && c.logframeActivityId === query.logframeActivityId;
      const sameTitle = titleRepeats(query.title, c.title);
      const reasons: string[] = [];
      if (mine) reasons.push(WORKPLAN_COPY.linkYouLead);
      if (sameNode) reasons.push(WORKPLAN_COPY.linkSameLogframe);
      const dates = c.plannedStart === c.plannedEnd ? formatShortDate(c.plannedStart, query.date) : `${formatShortDate(c.plannedStart, query.date)} to ${formatShortDate(c.plannedEnd, query.date)}`;
      reasons.push(`${WORKPLAN_COPY.linkPlannedFor} ${dates}`);
      return { id: c.id, reasons, rank: [mine ? 0 : 1, sameNode ? 0 : 1, sameTitle ? 0 : 1, distance(c, query.date)] as const };
    })
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] || a.rank[3] - b.rank[3] || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, reasons }) => ({ id, reasons }));
}
