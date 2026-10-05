import { CADENCE_REPORT_TYPES } from "./report-scope.js";
import { FINANCE_REPORT_TYPES } from "../finance/finance-data-mode.js";
import { suggestPeriodDates } from "./period-cadence.js";

/**
 * The rules about which reporting periods a project may create, in one place. The create handler
 * *enforces* them and the "what you can create" panel *explains* them by calling the same
 * functions, so an explanation can never drift from a refusal.
 */

export const ROLL_UP_REPORT_TYPES: ReadonlySet<string> = new Set(["SEMI_ANNUAL", "ANNUAL", "FINAL"]);

const typeWords = (reportType: string) => reportType.toLowerCase().replace(/_/g, "-");

/** The refusal for a cadence period that overlaps another; says what to do instead. */
export function periodOverlapMessage(reportType: string): string {
  const base = "Reporting period overlaps an existing period for this project";
  if (!ROLL_UP_REPORT_TYPES.has(reportType)) return base;
  return `${base}. A ${typeWords(reportType)} report is a period of its own in your reporting cadence: it states progress since the project started, using every earlier period, so create it for the closing period (for example the last month) instead of one that spans periods already created. For a one-off report over dates that already have periods, use a Custom report.`;
}

export interface PeriodFact {
  id: string;
  reportType: string;
  start: Date;
  end: Date;
}

/** Only cadence periods may not overlap each other; activity/situation/custom reports may sit inside one. */
export function findCadenceOverlap(reportType: string, range: { start: Date; end: Date }, existing: ReadonlyArray<PeriodFact>): PeriodFact | undefined {
  if (!CADENCE_REPORT_TYPES.has(reportType)) return undefined;
  return existing.find(
    (p) => CADENCE_REPORT_TYPES.has(p.reportType) && p.start.getTime() <= range.end.getTime() && range.start.getTime() <= p.end.getTime(),
  );
}

export interface PeriodTypeOption {
  type: string;
  label: string;
  /** What this report is for, in one sentence. */
  what: string;
  available: boolean;
  /** Why it is not available (only when `available` is false). */
  why?: string;
  /** What to do about it (only when `available` is false). */
  nextAction?: string;
  /** Financial figures can be entered for this type (when the project's finance mode is on). */
  financeAvailable: boolean;
  /** The dates the next period of this type should take, when it has a fixed cadence. */
  suggestedDates?: { startDate: string; endDate: string };
}

const GUIDE: ReadonlyArray<{ type: string; label: string; what: string }> = [
  { type: "MONTHLY", label: "Monthly", what: "Your regular monthly report; periods follow one another without gaps or overlaps." },
  { type: "QUARTERLY", label: "Quarterly", what: "A three-month report. Finance can be reported on it." },
  { type: "SEMI_ANNUAL", label: "Semi-annual", what: "A six-month report that rolls up progress since the project started. Finance can be reported on it." },
  { type: "ANNUAL", label: "Annual", what: "A twelve-month report that rolls up progress since the project started. Finance can be reported on it." },
  { type: "FINAL", label: "Final", what: "The closing report: it closes your cadence, covers the project's whole life and can report finance." },
  { type: "ACTIVITY", label: "Activity", what: "A short report on activities you pick; it may sit inside a regular period." },
  { type: "SITUATION", label: "Situation", what: "A short update on an event, as of a date; it may sit inside a regular period." },
  { type: "CUSTOM", label: "Custom", what: "A one-off report over any dates, including dates that already have periods." },
];

export interface PeriodOptionsInput {
  projectStart: Date;
  projectEnd: Date;
  /** DRAFT | ACTIVE | PAUSED | COMPLETED | ARCHIVED */
  projectStatus: string;
  existing: ReadonlyArray<PeriodFact>;
  activityCount: number;
}

/** What may be created now, per report type, with the reason and the next step when it may not. */
export function describePeriodTypes(input: PeriodOptionsInput): PeriodTypeOption[] {
  const closed = input.projectStatus === "COMPLETED" || input.projectStatus === "ARCHIVED";
  const cadenceEnds = input.existing.filter((p) => CADENCE_REPORT_TYPES.has(p.reportType)).map((p) => p.end);
  const hasFinal = input.existing.some((p) => p.reportType === "FINAL");

  return GUIDE.map((g): PeriodTypeOption => {
    const base = { type: g.type, label: g.label, what: g.what, financeAvailable: FINANCE_REPORT_TYPES.has(g.type) };
    if (closed) {
      return { ...base, available: false, why: `This project is ${input.projectStatus.toLowerCase()}, so it takes no new reports.`, nextAction: input.projectStatus === "ARCHIVED" ? "Restore the project to create reports." : "Reopen the project to create reports." };
    }
    if (CADENCE_REPORT_TYPES.has(g.type)) {
      if (hasFinal) {
        return { ...base, available: false, why: "A final report already closes your cadence, so no further regular periods can be added.", nextAction: "Use a Custom report for a one-off over dates that already have periods." };
      }
      const dates = suggestPeriodDates(g.type, input.projectStart, input.projectEnd, cadenceEnds);
      if (!dates) {
        return { ...base, available: false, why: "Every part of the project's dates already has a period.", nextAction: "Use a Custom report for a one-off, or extend the project's end date." };
      }
      return { ...base, available: true, suggestedDates: dates };
    }
    if (g.type === "ACTIVITY" && input.activityCount === 0) {
      return { ...base, available: false, why: "An activity report covers activities you pick, and none are recorded yet.", nextAction: "Record an activity first." };
    }
    return { ...base, available: true };
  });
}
