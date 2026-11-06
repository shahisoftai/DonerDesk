/**
 * First dates for "Start from my logframe": the ticked activities are spread in order across the project dates,
 * each in its own equal slot; a row switched to "Monthly" starts in the first week and repeats monthly to the
 * project end. Suggestions only: every date stays editable in the wizard.
 */
import { addDays, compareDates, daysBetween, type PlainDate } from "./plain-date.js";
import type { RecurrenceRule } from "./recurrence.js";

export interface PlanDateRequest {
  nodeId: string;
  monthly?: boolean;
}

export interface ProposedPlanDates {
  nodeId: string;
  start: PlainDate;
  end: PlainDate;
  repeats?: RecurrenceRule;
}

/** Length of the first occurrence of a monthly activity. */
const MONTHLY_FIRST_LENGTH_DAYS = 6;

export function proposePlanDates(rows: ReadonlyArray<PlanDateRequest>, project: { start: PlainDate; end: PlainDate }): ProposedPlanDates[] {
  const span = Math.max(0, daysBetween(project.start, project.end)) + 1;
  const spread = rows.filter((r) => !r.monthly);
  const slot = spread.length > 0 ? span / spread.length : span;
  let index = 0;
  return rows.map((row) => {
    if (row.monthly) {
      const end = addDays(project.start, Math.min(MONTHLY_FIRST_LENGTH_DAYS, span - 1));
      return { nodeId: row.nodeId, start: project.start, end, repeats: { every: "MONTH", interval: 1, until: project.end } };
    }
    const start = addDays(project.start, Math.floor(index * slot));
    const rawEnd = addDays(project.start, Math.max(Math.floor(index * slot), Math.floor((index + 1) * slot) - 1));
    index += 1;
    return { nodeId: row.nodeId, start, end: compareDates(rawEnd, project.end) > 0 ? project.end : rawEnd };
  });
}
