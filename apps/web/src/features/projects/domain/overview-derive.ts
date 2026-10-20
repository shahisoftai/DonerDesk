import { cellPercentOfTarget, indexCells, type DataSheet, type DataSheetIndicator } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { addDays, addMonths, compareDates, daysBetween, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";

/**
 * What the project Overview says, derived from facts. Pure: no React, no fetch, no clock of its own
 * (today is passed in), so every number on the page can be tested and re-read.
 *
 * Three rules run through everything here:
 * - a missing value is never 0 (an unrecorded indicator is absent, not "0%");
 * - a rate has no "% of target" (rate indicators are left out of the pace counts);
 * - no score is invented (pace is a share beside the share of time elapsed, and a count of indicators).
 */

/* ------------------------------------------------------------------ lifecycle */

export type LifecycleStage = "SETUP" | "IMPLEMENTATION" | "CLOSEOUT" | "ENDED";

export interface Lifecycle {
  stage: LifecycleStage;
  /** Days left until the project ends; never negative. */
  daysRemaining: number;
  /** Share of the project's time that has passed, 0–100. */
  timeElapsedPercent: number;
  /** The reporting periods of the project, as the programme counts them. */
  currentPeriod: number;
  totalPeriods: number;
  /** "quarter", "month", "half-year" or "year" — the unit of the programme's reporting cadence. */
  periodUnit: string;
  /** True in the project's last six months. */
  finalYear: boolean;
}

const CADENCE_UNIT: Readonly<Record<string, string>> = {
  MONTHLY: "month",
  QUARTERLY: "quarter",
  SEMI_ANNUAL: "half-year",
  ANNUAL: "year",
  CUSTOM: "period",
};

/** How many months one reporting period of this cadence covers. */
const CADENCE_MONTHS: Readonly<Record<string, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

export interface LifecyclePeriod {
  reportType: string;
  startDate: string;
  endDate: string;
}

export function lifecycle(input: {
  startDate: string;
  endDate: string;
  today: string;
  periods: readonly LifecyclePeriod[];
  /** The project's own reporting cadence, used before its first period exists. */
  reportingFrequency?: string;
}): Lifecycle {
  const start = input.startDate.slice(0, 10) as PlainDate;
  const end = input.endDate.slice(0, 10) as PlainDate;
  const today = input.today.slice(0, 10) as PlainDate;
  const totalDays = Math.max(1, daysBetween(start, end));
  const elapsed = daysBetween(start, today);
  const timeElapsedPercent = clamp(Math.round((elapsed / totalDays) * 100), 0, 100);
  const daysRemaining = Math.max(0, daysBetween(today, end));
  const reportType = input.periods[0]?.reportType ?? input.reportingFrequency ?? "";
  const cadenceMonths = CADENCE_MONTHS[reportType] ?? 0;
  const totalMonths = monthsBetween(start, end);
  const elapsedMonths = monthsBetween(start, today);
  // The programme's periods are counted from its cadence and its life, not only from the periods
  // that exist so far: a project eight quarters long says "of 8" from its first day.
  const totalPeriods = cadenceMonths > 0 ? Math.max(1, Math.round(totalMonths / cadenceMonths)) : input.periods.length;
  const started = input.periods.filter((p) => compareDates(p.startDate.slice(0, 10) as PlainDate, today) <= 0);
  const currentPeriod =
    cadenceMonths > 0
      ? clamp(Math.floor(elapsedMonths / cadenceMonths) + 1, 1, totalPeriods)
      : Math.max(1, started.length);
  const stage: LifecycleStage =
    elapsed < 0 ? "SETUP" : elapsed > totalDays ? "ENDED" : daysRemaining <= 183 ? "CLOSEOUT" : "IMPLEMENTATION";
  return {
    stage,
    daysRemaining,
    timeElapsedPercent,
    currentPeriod,
    totalPeriods,
    periodUnit: CADENCE_UNIT[reportType] ?? "period",
    finalYear: daysRemaining <= 183,
  };
}

/** Whole months between two plain dates (the day of the month is not counted). */
function monthsBetween(from: PlainDate, to: PlainDate): number {
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  const months = Number(to.slice(5, 7)) - Number(from.slice(5, 7));
  return years * 12 + months;
}

/* ------------------------------------------------------------------ results pace */

export interface ResultsPace {
  /** Indicators with a recorded value that can be read as a share of target. */
  measured: number;
  /** Of those, the ones behind the clock (more than two points behind). */
  behind: number;
  /** Of those, the ones at or ahead of the clock. */
  atOrAhead: number;
  /** Indicators that were never measured: absent, never 0. */
  notMeasured: number;
  /** The share of the project's time that has passed, for the side-by-side reading. */
  timeElapsedPercent: number;
}

const PACE_TOLERANCE_POINTS = 2;

function percentNumber(percent: string): number | null {
  const value = Number.parseFloat(percent.replace("%", ""));
  return Number.isFinite(value) ? value : null;
}

/** The latest recorded share of target for one indicator, or null when it was never measured. */
export function latestPercentOfTarget(sheet: DataSheet, indicator: DataSheetIndicator): number | null {
  if (indicator.isRate) return null;
  const cells = indexCells(sheet);
  const periods = [...sheet.periods].sort((a, b) => b.end.localeCompare(a.end));
  for (const period of periods) {
    const percent = percentNumber(cellPercentOfTarget(indicator, cells.get(`${indicator.id}|${period.id}`)));
    if (percent !== null) return percent;
  }
  return null;
}

export function resultsPace(sheet: DataSheet, timeElapsedPercent: number): ResultsPace {
  const measured: number[] = [];
  let notMeasured = 0;
  for (const indicator of sheet.indicators) {
    if (indicator.isRate) continue;
    const percent = latestPercentOfTarget(sheet, indicator);
    if (percent === null) {
      notMeasured += 1;
      continue;
    }
    measured.push(percent);
  }
  const behind = measured.filter((p) => p < timeElapsedPercent - PACE_TOLERANCE_POINTS).length;
  return { measured: measured.length, behind, atOrAhead: measured.length - behind, notMeasured, timeElapsedPercent };
}

/* ------------------------------------------------------------------ budget pace */

export interface BudgetPace {
  currency: string;
  budget: number;
  expenditure: number;
  /** Share of the budget spent, or null when the budget is not a usable number. */
  spentPercent: number | null;
  /** The last period whose figures are verified. */
  verifiedThrough: string | null;
}

function numeric(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Budget against spending, one block per currency (currencies are never added together). */
export function budgetPace(sheet: DataSheet, periodLabels: ReadonlyMap<string, string>): BudgetPace[] {
  const byCurrency = new Map<string, { budget: number; expenditure: number; verifiedThrough: string | null }>();
  const ordered = [...sheet.periods].sort((a, b) => a.end.localeCompare(b.end));
  for (const row of sheet.finance) {
    const current = byCurrency.get(row.currency) ?? { budget: 0, expenditure: 0, verifiedThrough: null };
    const budget = numeric(row.budget);
    const expenditure = numeric(row.expenditure);
    if (budget !== null) current.budget += budget;
    if (expenditure !== null) current.expenditure += expenditure;
    if (row.verified) {
      const label = periodLabels.get(row.periodId) ?? null;
      current.verifiedThrough = label;
    }
    byCurrency.set(row.currency, current);
  }
  return [...byCurrency.entries()].map(([currency, totals]) => ({
    currency,
    budget: totals.budget,
    expenditure: totals.expenditure,
    spentPercent: totals.budget > 0 ? Math.round((totals.expenditure / totals.budget) * 100) : null,
    verifiedThrough: totals.verifiedThrough,
  }));
}

/* ------------------------------------------------------------------ headline indicator */

export interface HeadlineSeriesPoint {
  periodId: string;
  label: string;
  /** Share of target at that period, or null when nothing was recorded. */
  percent: number | null;
}

export interface HeadlineIndicator {
  indicator: DataSheetIndicator;
  series: HeadlineSeriesPoint[];
}

const LEVEL_ORDER: Readonly<Record<string, number>> = { GOAL: 0, OUTCOME: 1, OUTPUT: 2, ACTIVITY: 3 };

/**
 * The one indicator the trend chart draws: the highest level that has recorded values, and among those
 * the one with the most of them. A rate is never chosen — it has no "% of target" to draw.
 */
export function headlineIndicator(sheet: DataSheet): HeadlineIndicator | null {
  const cells = indexCells(sheet);
  const periods = [...sheet.periods].sort((a, b) => a.end.localeCompare(b.end));
  const candidates = sheet.indicators
    .filter((indicator) => !indicator.isRate)
    .map((indicator) => {
      const points = periods.map((period) => {
        const percent = percentNumber(cellPercentOfTarget(indicator, cells.get(`${indicator.id}|${period.id}`)));
        return { periodId: period.id, label: period.label, percent };
      });
      return { indicator, points, recorded: points.filter((p) => p.percent !== null).length };
    })
    .filter((candidate) => candidate.recorded > 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const levelA = LEVEL_ORDER[a.indicator.level ?? ""] ?? 9;
    const levelB = LEVEL_ORDER[b.indicator.level ?? ""] ?? 9;
    if (levelA !== levelB) return levelA - levelB;
    if (a.recorded !== b.recorded) return b.recorded - a.recorded;
    return a.indicator.code.localeCompare(b.indicator.code);
  });
  const best = candidates[0]!;
  return { indicator: best.indicator, series: best.points };
}

/* ------------------------------------------------------------------ calendar */

export type CalendarKind = "PLAN" | "REPORT" | "RISK_REVIEW" | "REQUEST" | "VALUE" | "CHECKLIST";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  date: string;
  title: string;
  detail: string;
  href: string;
  overdue: boolean;
  /** True when the item is the caller's own work. */
  mine: boolean;
}

export interface CalendarInput {
  today: string;
  horizonDays?: number;
  planRows: ReadonlyArray<{ id: string; title: string; plannedEnd: string; status: string; signal: string; ownerUserId?: string | undefined }>;
  periods: ReadonlyArray<{ id: string; reportType: string; status: string; deadline: string; daysUntilDeadline: number; readinessScore: number }>;
  risks: ReadonlyArray<{ id: string; title: string; reviewBy?: string | undefined; status: string; seriousness: string }>;
  assignments: ReadonlyArray<{ key: string; kind: string; title: string; dueDate?: string | undefined; state: string; href: string; projectId: string }>;
  projectId: string;
  /** The person reading the page, so their own work can be marked. */
  meId?: string | undefined;
  limit?: number;
}

const ASSIGNMENT_KIND_TO_CALENDAR: Readonly<Record<string, CalendarKind>> = {
  TASK: "REQUEST",
  INDICATOR_VALUE: "VALUE",
  CHECKLIST_ITEM: "CHECKLIST",
  REPORT_DEADLINE: "REPORT",
  EVIDENCE_REVIEW: "CHECKLIST",
  ACTIVITY_REVIEW: "CHECKLIST",
  ACTIVITY_FIX: "CHECKLIST",
  PLAN_ITEM: "PLAN",
};

/** Everything due in the coming weeks, from every stream, in one list. */
export function calendarItems(input: CalendarInput): CalendarItem[] {
  const today = input.today.slice(0, 10) as PlainDate;
  const horizon = addDays(today, input.horizonDays ?? 42);
  const items: CalendarItem[] = [];

  for (const row of input.planRows) {
    if (row.status === "DONE" || row.status === "CANCELLED") continue;
    const end = row.plannedEnd.slice(0, 10) as PlainDate;
    if (compareDates(end, horizon) > 0) continue;
    items.push({
      id: `plan-${row.id}`,
      kind: "PLAN",
      date: row.plannedEnd.slice(0, 10),
      title: row.title,
      detail: row.signal === "LATE" ? "Planned work is late" : "Planned work ends",
      href: `/projects/${input.projectId}/activities/plan/${row.id}`,
      overdue: compareDates(end, today) < 0,
      mine: Boolean(input.meId) && row.ownerUserId === input.meId,
    });
  }

  for (const period of input.periods) {
    const deadline = period.deadline.slice(0, 10) as PlainDate;
    if (compareDates(deadline, horizon) > 0) continue;
    items.push({
      id: `period-${period.id}`,
      kind: "REPORT",
      date: period.deadline.slice(0, 10),
      title: `${reportLabel(period.reportType)} report due`,
      detail: `${period.readinessScore}% ready`,
      href: `/projects/${input.projectId}/reports/${period.id}`,
      overdue: period.daysUntilDeadline < 0,
      mine: false,
    });
  }

  for (const risk of input.risks) {
    if (risk.status !== "OPEN" || !risk.reviewBy) continue;
    const review = risk.reviewBy.slice(0, 10) as PlainDate;
    if (compareDates(review, horizon) > 0) continue;
    items.push({
      id: `risk-${risk.id}`,
      kind: "RISK_REVIEW",
      date: risk.reviewBy.slice(0, 10),
      title: risk.title,
      detail: "Risk review",
      href: `/projects/${input.projectId}`,
      overdue: compareDates(review, today) < 0,
      mine: false,
    });
  }

  for (const assignment of input.assignments) {
    if (assignment.projectId !== input.projectId || !assignment.dueDate) continue;
    // A planned item is already on this list from the plan itself; listing it twice helps nobody.
    if (assignment.kind === "PLAN_ITEM") continue;
    const due = assignment.dueDate.slice(0, 10) as PlainDate;
    if (compareDates(due, horizon) > 0) continue;
    items.push({
      id: `assignment-${assignment.key}`,
      kind: ASSIGNMENT_KIND_TO_CALENDAR[assignment.kind] ?? "REQUEST",
      date: assignment.dueDate.slice(0, 10),
      title: assignment.title,
      detail: assignment.state === "LATE" ? "Overdue" : "Due",
      href: assignment.href,
      overdue: assignment.state === "LATE",
      mine: true,
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
  return items.slice(0, input.limit ?? 8);
}

function reportLabel(reportType: string): string {
  switch (reportType) {
    case "MONTHLY": return "Monthly";
    case "QUARTERLY": return "Quarterly";
    case "SEMI_ANNUAL": return "Half-yearly";
    case "ANNUAL": return "Annual";
    default: return "Project";
  }
}

/* ------------------------------------------------------------------ movements */

export interface Movement {
  id: string;
  title: string;
  from: string;
  to: string;
  ownerUserId: string | undefined;
}

/** Planned activities whose dates were moved, with the dates they moved from and to. */
export function movedThisQuarter(
  rows: ReadonlyArray<{ id: string; title: string; plannedEnd: string; originalEnd?: string | undefined; status: string; ownerUserId?: string | undefined }>,
  today: string,
): Movement[] {
  const day = today.slice(0, 10) as PlainDate;
  const year = Number.parseInt(day.slice(0, 4), 10);
  const month = Number.parseInt(day.slice(5, 7), 10);
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const quarterStart = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01` as PlainDate;
  const quarterEnd = addDays(addMonths(quarterStart, 3), -1);
  const movements: Movement[] = [];
  for (const row of rows) {
    if (!row.originalEnd) continue;
    if (row.originalEnd.slice(0, 10) === row.plannedEnd.slice(0, 10)) continue;
    const from = row.originalEnd.slice(0, 10) as PlainDate;
    const to = row.plannedEnd.slice(0, 10) as PlainDate;
    const inQuarter = compareDates(from, quarterEnd) <= 0 && compareDates(to, quarterStart) >= 0;
    if (!inQuarter) continue;
    movements.push({ id: row.id, title: row.title, from: row.originalEnd.slice(0, 10), to: row.plannedEnd.slice(0, 10), ownerUserId: row.ownerUserId });
  }
  return movements.sort((a, b) => a.to.localeCompare(b.to));
}

/* ------------------------------------------------------------------ the week */

export interface WeekItem {
  id: string;
  title: string;
  date: string;
  signal: string;
  ownerUserId: string | undefined;
}

/** The plan items that end this week, whoever owns them — the manager's week, not only mine. */
export function teamsWeek(
  rows: ReadonlyArray<{ id: string; title: string; plannedEnd: string; status: string; signal: string; ownerUserId?: string | undefined }>,
  today: string,
): WeekItem[] {
  const day = today.slice(0, 10) as PlainDate;
  const start = addDays(day, -6);
  const end = addDays(day, 7);
  return rows
    .filter((row) => row.status !== "DONE" && row.status !== "CANCELLED")
    .filter((row) => {
      const endDate = row.plannedEnd.slice(0, 10) as PlainDate;
      return compareDates(endDate, start) >= 0 && compareDates(endDate, end) <= 0;
    })
    .map((row) => ({ id: row.id, title: row.title, date: row.plannedEnd.slice(0, 10), signal: row.signal, ownerUserId: row.ownerUserId }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ needs you */

export type NeedsYouKind = "APPROVE_REPORT" | "ACCEPT_ACTIVITY" | "VERIFY_EVIDENCE" | "OVERDUE_VALUE" | "RISK_REVIEW" | "REQUEST";

export interface NeedsYouItem {
  id: string;
  kind: NeedsYouKind;
  title: string;
  why: string;
  href: string;
  /** Overdue first, then the order the kinds are listed in. */
  urgent: boolean;
}

export interface NeedsYouInput {
  today: string;
  projectId: string;
  canApproveReport: boolean;
  canReviewActivity: boolean;
  canVerifyEvidence: boolean;
  canManageRisks: boolean;
  periods: ReadonlyArray<{ id: string; reportType: string; status: string; readinessScore: number; deadline: string; daysUntilDeadline: number }>;
  assignments: ReadonlyArray<{ key: string; kind: string; title: string; dueDate?: string | undefined; state: string; href: string; projectId: string; because?: string | undefined }>;
  risks: ReadonlyArray<{ id: string; title: string; reviewBy?: string | undefined; status: string }>;
}

const KIND_ORDER: Readonly<Record<NeedsYouKind, number>> = {
  OVERDUE_VALUE: 0,
  RISK_REVIEW: 1,
  APPROVE_REPORT: 2,
  ACCEPT_ACTIVITY: 3,
  VERIFY_EVIDENCE: 4,
  REQUEST: 5,
};

/** What waits on this person on this project, most pressing first. */
export function needsYouItems(input: NeedsYouInput): NeedsYouItem[] {
  const today = input.today.slice(0, 10) as PlainDate;
  const items: NeedsYouItem[] = [];

  if (input.canApproveReport) {
    for (const period of input.periods) {
      if (period.status !== "UNDER_REVIEW") continue;
      items.push({
        id: `approve-${period.id}`,
        kind: "APPROVE_REPORT",
        title: `${reportLabel(period.reportType)} report is waiting for your approval`,
        why: `${period.readinessScore}% ready · due ${period.deadline.slice(0, 10)}`,
        href: `/projects/${input.projectId}/reports/${period.id}`,
        urgent: period.daysUntilDeadline <= 3,
      });
    }
  }

  const mine = input.assignments.filter((a) => a.projectId === input.projectId);
  const activities = mine.filter((a) => a.kind === "ACTIVITY_REVIEW" || a.kind === "ACTIVITY_FIX");
  if (input.canReviewActivity && activities.length > 0) {
    items.push({
      id: "activities",
      kind: "ACCEPT_ACTIVITY",
      title: activities.length === 1 ? "1 completed activity is waiting for you" : `${activities.length} completed activities are waiting for you`,
      why: activities.map((a) => a.title).slice(0, 2).join(" · "),
      href: `/projects/${input.projectId}/activities`,
      urgent: activities.some((a) => a.state === "LATE"),
    });
  }

  const evidence = mine.filter((a) => a.kind === "EVIDENCE_REVIEW");
  if (input.canVerifyEvidence && evidence.length > 0) {
    items.push({
      id: "evidence",
      kind: "VERIFY_EVIDENCE",
      title: evidence.length === 1 ? "1 evidence file is waiting for your verification" : `${evidence.length} evidence files are waiting for your verification`,
      why: "Verification is what lets a report be submitted",
      href: `/projects/${input.projectId}/evidence`,
      urgent: evidence.some((a) => a.state === "LATE"),
    });
  }

  const values = mine.filter((a) => a.kind === "INDICATOR_VALUE" && a.state === "LATE");
  if (values.length > 0) {
    items.push({
      id: "values",
      kind: "OVERDUE_VALUE",
      title: values.length === 1 ? "1 indicator value is overdue" : `${values.length} indicator values are overdue`,
      why: values.map((a) => a.title).slice(0, 2).join(" · "),
      href: `/projects/${input.projectId}/data`,
      urgent: true,
    });
  }

  const tasks = mine.filter((a) => a.kind === "TASK" && a.state === "LATE");
  if (tasks.length > 0) {
    items.push({
      id: "requests",
      kind: "REQUEST",
      title: tasks.length === 1 ? "1 request to you is overdue" : `${tasks.length} requests to you are overdue`,
      why: tasks.map((a) => a.title).slice(0, 2).join(" · "),
      href: `/projects/${input.projectId}/activities`,
      urgent: true,
    });
  }

  if (input.canManageRisks) {
    for (const risk of input.risks) {
      if (risk.status !== "OPEN" || !risk.reviewBy) continue;
      const review = risk.reviewBy.slice(0, 10) as PlainDate;
      if (compareDates(review, today) >= 0) continue;
      items.push({
        id: `risk-${risk.id}`,
        kind: "RISK_REVIEW",
        title: `Risk review overdue: “${risk.title}”`,
        why: `Review was due ${risk.reviewBy.slice(0, 10)}`,
        href: `/projects/${input.projectId}`,
        urgent: true,
      });
    }
  }

  items.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
  return items;
}

/* ------------------------------------------------------------------ close-out */

export interface CloseOut {
  monthsRemaining: number;
  finalYear: boolean;
}

/** How long the project still has, in whole months, and whether closing is near. */
export function closeOut(startDate: string, endDate: string, today: string): CloseOut {
  const life = lifecycle({ startDate, endDate, today, periods: [] });
  const end = endDate.slice(0, 10) as PlainDate;
  const day = today.slice(0, 10) as PlainDate;
  const months = Math.max(0, (Number(end.slice(0, 4)) - Number(day.slice(0, 4))) * 12 + (Number(end.slice(5, 7)) - Number(day.slice(5, 7))));
  return { monthsRemaining: months, finalYear: life.finalYear };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
