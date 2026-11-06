import { suggestPeriodDates, type SuggestedPeriodDates } from "./period-cadence.js";
import { periodForDate } from "./period-for-date.js";
import { CADENCE_REPORT_TYPES } from "./report-scope.js";

/**
 * What to do when someone records a value for a day: it already falls in a reporting period, the project's own cadence says which
 * period to open for it, or it cannot be given one (and why). The screen's explanation and the handler that opens the period both
 * read this one function, so "November is not open yet" and the period that gets created can never disagree. Pure: today is never
 * read; the dates are plain `YYYY-MM-DD` days.
 */

export interface ProposalPeriod {
  id: string;
  reportType: string;
  startDate: string;
  endDate: string;
  cancelled?: boolean | undefined;
}

export interface PeriodProposalInput {
  /** The day the value is for, `YYYY-MM-DD`. */
  date: string;
  projectStart: string;
  projectEnd: string;
  /** The project's reporting frequency (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL); anything else has no cadence to propose from. */
  reportingFrequency: string;
  /** DRAFT | ACTIVE | PAUSED | COMPLETED | ARCHIVED */
  projectStatus: string;
  periods: ReadonlyArray<ProposalPeriod>;
}

export type PeriodProposalRefusal =
  | "BAD_DATE"
  | "CLOSED_PROJECT"
  | "BEFORE_PROJECT"
  | "AFTER_PROJECT"
  | "NO_CADENCE"
  /** The day sits before the latest period, so opening the next one in the chain cannot reach it: a manager chooses the dates. */
  | "NOT_NEXT_IN_CHAIN";

export type PeriodProposal =
  | { kind: "COVERED"; periodId: string }
  /** `periods` are every period to open, in order, ending with the one that holds the day (`target`). More than one means earlier months were skipped. */
  | { kind: "PROPOSE"; reportType: string; target: SuggestedPeriodDates; periods: SuggestedPeriodDates[] }
  | { kind: "NONE"; reason: PeriodProposalRefusal };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A safety stop: 20 years of monthly periods. A real chain is a handful. */
const MAX_CHAIN = 240;

function validDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const t = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === value;
}

export function proposePeriodForDate(input: PeriodProposalInput): PeriodProposal {
  if (!validDay(input.date) || !validDay(input.projectStart) || !validDay(input.projectEnd)) return { kind: "NONE", reason: "BAD_DATE" };
  const live = input.periods.filter((p) => !p.cancelled);

  // A day that is already inside a period needs nothing: the same rule as the activity form and the import.
  const covered = periodForDate(live, input.date);
  if (covered !== undefined) return { kind: "COVERED", periodId: covered };

  if (input.projectStatus === "COMPLETED" || input.projectStatus === "ARCHIVED") return { kind: "NONE", reason: "CLOSED_PROJECT" };
  if (input.date < input.projectStart) return { kind: "NONE", reason: "BEFORE_PROJECT" };
  if (input.date > input.projectEnd) return { kind: "NONE", reason: "AFTER_PROJECT" };

  const frequency = input.reportingFrequency;
  const cadenceEnds = live.filter((p) => CADENCE_REPORT_TYPES.has(p.reportType)).map((p) => p.endDate);
  const first = suggestPeriodDates(frequency, input.projectStart, input.projectEnd, cadenceEnds);
  if (!first) {
    // No next period exists: either the type has no cadence, or the project's dates are already fully covered.
    return { kind: "NONE", reason: CADENCE_FREQUENCIES.has(frequency) ? "NOT_NEXT_IN_CHAIN" : "NO_CADENCE" };
  }

  const chain: SuggestedPeriodDates[] = [];
  let ends = cadenceEnds;
  let next: SuggestedPeriodDates | null = first;
  for (let i = 0; next && i < MAX_CHAIN; i += 1) {
    chain.push(next);
    if (next.startDate <= input.date && input.date <= next.endDate) {
      return { kind: "PROPOSE", reportType: frequency, target: next, periods: chain };
    }
    if (next.startDate > input.date) break;
    ends = [...ends, next.endDate];
    next = suggestPeriodDates(frequency, input.projectStart, input.projectEnd, ends);
  }
  return { kind: "NONE", reason: "NOT_NEXT_IN_CHAIN" };
}

const CADENCE_FREQUENCIES: ReadonlySet<string> = new Set(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]);
