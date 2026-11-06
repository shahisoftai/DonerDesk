/**
 * The reporting calendar a draft implies (Phase 38.7): the periods the project's own dates and cadence produce — the same
 * date arithmetic the new-period form and "create all periods" use, so what the wizard shows is what Launch will create —
 * each with the due date its report type's rule gives. Roll-up reports (semi-annual, annual) are opened one at a time and are
 * not listed. Nothing is invented: without dates or a fixed cadence the calendar is empty and says why. Pure.
 */
import { planCadencePeriods, suggestDeadline } from "../../reporting/period-cadence.js";
import type { SetupDraft } from "./draft.js";
import { isLive } from "./requirements/shared.js";

export interface SchedulePeriodRow {
  reportType: string;
  startDate: string;
  endDate: string;
  /** The end date plus the report type's due days, or null when no rule says. */
  dueDate: string | null;
  /** The last block, which reaches the project's end and belongs to the final report. */
  closing: boolean;
}

export interface ScheduleTimeline {
  periods: SchedulePeriodRow[];
  /** Why the calendar is empty or short, in plain words. */
  note?: string;
}

/** The cadences with a fixed calendar; the rest are opened one at a time. */
export const FIXED_CADENCES: Readonly<Record<string, string>> = { MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY" };

/** The cadence in force: the person's choice, else the first one a document stated. */
export function cadenceOf(draft: SetupDraft): string | undefined {
  const chosen = draft.extras.schedule.cadence;
  if (chosen) return chosen;
  return draft.proposal.periods.find((p) => isLive(p) && p.value?.type)?.value?.type ?? undefined;
}

/**
 * The due days Launch writes to the project: the rule of the report type the cadence makes (monthly reports take the monthly
 * rule). A project has one offset for every period it creates, so the cadence's own rule is the one that applies; null when
 * no cadence or no rule says, which leaves the organisation's default.
 */
export function launchDeadlineOffset(draft: SetupDraft): number | null {
  const cadence = cadenceOf(draft);
  const type = cadence ? FIXED_CADENCES[cadence] : undefined;
  if (!type) return null;
  return draft.extras.schedule.rules.find((r) => r.reportType === type)?.dueDaysAfterEnd ?? null;
}

export function scheduleTimeline(draft: SetupDraft): ScheduleTimeline {
  const f = draft.proposal.facts;
  const start = isLive(f.startDate) ? f.startDate.value : null;
  const end = isLive(f.endDate) ? f.endDate.value : null;
  if (!start || !end || end <= start) return { periods: [], note: "Enter the project's start and end dates first." };
  const cadence = cadenceOf(draft);
  const type = cadence ? FIXED_CADENCES[cadence] : undefined;
  if (!type) return { periods: [], note: cadence ? "This reporting frequency has no fixed calendar; each report is opened when it is due." : "Choose how often the project reports." };
  const due = (reportType: string): number | null => draft.extras.schedule.rules.find((r) => r.reportType === reportType)?.dueDaysAfterEnd ?? null;
  const plan = planCadencePeriods(type, start, end);
  const row = (p: { startDate: string; endDate: string }, reportType: string, closing: boolean): SchedulePeriodRow => {
    const days = due(reportType);
    return { reportType, startDate: p.startDate, endDate: p.endDate, dueDate: days === null ? null : suggestDeadline(p.endDate, days), closing };
  };
  const periods = [...plan.periods.map((p) => row(p, type, false)), ...(plan.closing ? [row(plan.closing, "FINAL", true)] : [])];
  return periods.length === 0 ? { periods, note: "The project is too short for a full period." } : { periods };
}
