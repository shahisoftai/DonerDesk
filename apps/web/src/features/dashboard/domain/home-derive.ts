/**
 * What the Home pages say, derived from data the API already returns. Pure: today is passed in, nothing is fetched.
 * A missing figure is never zero here; a count is shown only when its source answered.
 */
export interface NeedsYouInput {
  reportsOverdue: number;
  highRisks: number;
  risksReviewOverdue: number;
  evidenceToReview: number | null;
  activitiesToReview: number | null;
  checklistBlockers: number | null;
}

export interface NeedsYouItem { key: string; count: number; title: string; detail: string; href: string; tone: "danger" | "warning" | "info" }

/** Most pressing first; an item with a zero or unknown count is left out. */
export function needsYouItems(i: NeedsYouInput): NeedsYouItem[] {
  const all: Array<NeedsYouItem | null> = [
    i.reportsOverdue > 0 ? { key: "reports-overdue", count: i.reportsOverdue, title: i.reportsOverdue === 1 ? "Report is overdue" : "Reports are overdue", detail: "Open the reports list", href: "/reports?band=overdue", tone: "danger" } : null,
    i.highRisks > 0 ? { key: "serious-risks", count: i.highRisks, title: i.highRisks === 1 ? "Serious problem or risk" : "Serious problems and risks", detail: "Across your portfolio", href: "/portfolio", tone: "danger" } : null,
    i.risksReviewOverdue > 0 ? { key: "risk-reviews", count: i.risksReviewOverdue, title: i.risksReviewOverdue === 1 ? "Risk review is overdue" : "Risk reviews are overdue", detail: "Review dates have passed", href: "/portfolio", tone: "warning" } : null,
    i.checklistBlockers ? { key: "checklist", count: i.checklistBlockers, title: i.checklistBlockers === 1 ? "Compliance blocker" : "Compliance blockers", detail: "Open checklist items", href: "/compliance", tone: "warning" } : null,
    i.activitiesToReview ? { key: "activities", count: i.activitiesToReview, title: i.activitiesToReview === 1 ? "Activity to review" : "Activities to review", detail: "Completed work waiting for a decision", href: "/my-work?type=activity", tone: "warning" } : null,
    i.evidenceToReview ? { key: "evidence", count: i.evidenceToReview, title: i.evidenceToReview === 1 ? "File to verify" : "Files to verify", detail: "Evidence waiting for review", href: "/evidence", tone: "info" } : null,
  ];
  return all.filter((x): x is NeedsYouItem => x !== null);
}

export interface PortfolioRowLike {
  projectId: string;
  title: string;
  delivery: { band: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_PLAN" };
  reporting: { periodId: string; deadline: string; daysUntil: number; readinessScore: number } | null;
}

export interface HealthCounts { onTrack: number; atRisk: number; offTrack: number; noPlan: number }

export function healthCounts(rows: ReadonlyArray<PortfolioRowLike>): HealthCounts {
  const c: HealthCounts = { onTrack: 0, atRisk: 0, offTrack: 0, noPlan: 0 };
  for (const r of rows) {
    if (r.delivery.band === "ON_TRACK") c.onTrack += 1;
    else if (r.delivery.band === "AT_RISK") c.atRisk += 1;
    else if (r.delivery.band === "OFF_TRACK") c.offTrack += 1;
    else c.noPlan += 1;
  }
  return c;
}

export interface UpcomingReport { projectId: string; periodId: string; title: string; deadline: string; daysUntil: number; readinessScore: number }

/** The next reports across projects, overdue first, then soonest. */
export function upcomingReports(rows: ReadonlyArray<PortfolioRowLike>, limit: number): UpcomingReport[] {
  return rows
    .filter((r): r is PortfolioRowLike & { reporting: NonNullable<PortfolioRowLike["reporting"]> } => r.reporting !== null)
    .map((r) => ({ projectId: r.projectId, periodId: r.reporting.periodId, title: r.title, deadline: r.reporting.deadline, daysUntil: r.reporting.daysUntil, readinessScore: r.reporting.readinessScore }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit);
}

export function reportsDueWithin(rows: ReadonlyArray<PortfolioRowLike>, days: number): number {
  return rows.filter((r) => r.reporting !== null && r.reporting.daysUntil <= days).length;
}

export function dueLabel(days: number): string {
  return days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"}`;
}

/** The headline under the greeting: the single most useful sentence. */
export function homeHeadline(needs: ReadonlyArray<NeedsYouItem>): string {
  if (needs.length === 0) return "Nothing needs your decision right now.";
  const top = needs[0]!;
  const total = needs.reduce((n, x) => n + x.count, 0);
  return needs.length === 1 ? `${top.count} ${top.title.toLowerCase()}.` : `${total} items need you, starting with ${top.count} ${top.title.toLowerCase()}.`;
}

/* ------------------------------------------------------------------ pace, pipeline, calendar tiles */

/** A bar against the clock: `value` is a share (0–100) or null when nothing usable was recorded (never drawn as 0). */
export interface PaceReading { value: number | null; timeElapsed: number; ahead: boolean | null }

const PACE_TOLERANCE = 2;

export function paceReading(value: number | null, timeElapsed: number): PaceReading {
  const v = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
  return { value: v, timeElapsed, ahead: v === null ? null : v >= timeElapsed - PACE_TOLERANCE };
}

export type PipelineStage = "DRAFTING" | "IN_REVIEW" | "APPROVED" | "SUBMITTED";

export const PIPELINE_STAGE_LABEL: Readonly<Record<PipelineStage, string>> = {
  DRAFTING: "Drafting", IN_REVIEW: "In review", APPROVED: "Approved", SUBMITTED: "Submitted",
};

/** Every period status maps to one stage; unknown statuses are drafting, so nothing disappears from the board. */
export function pipelineStageOf(status: string): PipelineStage {
  switch (status) {
    case "UNDER_REVIEW": return "IN_REVIEW";
    case "APPROVED": return "APPROVED";
    case "SUBMITTED": case "CLOSED": return "SUBMITTED";
    default: return "DRAFTING";
  }
}

export interface PipelinePeriod { projectId: string; projectTitle: string; periodId: string; status: string; deadline: string; daysUntil: number }

export function pipelineBoard(periods: ReadonlyArray<PipelinePeriod>, perStage: number): Array<{ stage: PipelineStage; label: string; count: number; items: PipelinePeriod[] }> {
  const stages: PipelineStage[] = ["DRAFTING", "IN_REVIEW", "APPROVED", "SUBMITTED"];
  return stages.map((stage) => {
    const inStage = periods.filter((p) => pipelineStageOf(p.status) === stage);
    // Open stages show the most urgent first; the submitted stage shows the latest.
    const ordered = [...inStage].sort((a, b) => (stage === "SUBMITTED" ? b.daysUntil - a.daysUntil : a.daysUntil - b.daysUntil));
    return { stage, label: PIPELINE_STAGE_LABEL[stage], count: inStage.length, items: ordered.slice(0, perStage) };
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day and month of a plain date, read from the text so no time zone can shift it. */
export function dateTile(iso: string): { day: string; month: string } {
  return { day: iso.slice(8, 10), month: MONTHS[Number(iso.slice(5, 7)) - 1] ?? "" };
}

export function urgencyTone(days: number): "danger" | "warning" | "success" {
  return days < 0 ? "danger" : days <= 14 ? "warning" : "success";
}

/* ------------------------------------------------------------------ weekly delivery history */

export interface PlanRowLike { plannedEnd: string; state: string; status: string }

export interface WeekPoint { weekStart: string; judged: number; onTime: number; percent: number | null }

/** The Monday of the week a plain date falls in (ISO weeks start on Monday). */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * For each of the last `weeks` completed weeks: of the planned activities that were due to end that week, the share finished on time.
 * A week is judged only once it is over, and cancelled items are not counted. A week with nothing to judge is null, never 0.
 */
export function weeklyDelivery(rows: ReadonlyArray<PlanRowLike>, today: string, weeks: number): WeekPoint[] {
  const thisMonday = mondayOf(today);
  const points: WeekPoint[] = [];
  for (let i = weeks; i >= 1; i--) {
    const weekStart = addDaysIso(thisMonday, -7 * i);
    const weekEnd = addDaysIso(weekStart, 6);
    const due = rows.filter((r) => r.status !== "CANCELLED" && r.plannedEnd.slice(0, 10) >= weekStart && r.plannedEnd.slice(0, 10) <= weekEnd);
    const judged = due.length;
    const onTime = due.filter((r) => r.state === "DONE").length;
    points.push({ weekStart, judged, onTime, percent: judged === 0 ? null : Math.round((onTime / judged) * 100) });
  }
  return points;
}

/** The overall share on time across the given weeks, or null when none was judged. */
export function onTimeShare(points: ReadonlyArray<WeekPoint>): number | null {
  const judged = points.reduce((n, p) => n + p.judged, 0);
  const onTime = points.reduce((n, p) => n + p.onTime, 0);
  return judged === 0 ? null : Math.round((onTime / judged) * 100);
}
