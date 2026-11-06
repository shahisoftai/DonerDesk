/**
 * What the plan says about a reporting period: how many activities were planned for it and how many were held, with the
 * recorded reasons for the ones moved or cancelled. Pure; one rule shared by the writer input, the record chunks, the
 * "Suggested from your plan" story fields and the readiness advice, so they cannot disagree.
 *
 * Counts and reasons only: a writer never receives names, statuses or workflow words (`WRITER_EXCLUDED_PERIOD_KEYS`).
 */
import { compareDates, type PlainDate } from "./plain-date.js";
import type { PlanStatus } from "./plan-status-transitions.js";

export interface PlanDeliveryItem {
  status: PlanStatus;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  /** True when the dates were moved from the first ones saved. */
  moved: boolean;
  /** Why it was moved (latest recorded reason) or cancelled. */
  reason?: string;
}

export interface PlanDeliverySummary {
  /** Activities whose planned end falls in the period, not counting cancelled ones. */
  planned: number;
  held: number;
  /** Planned and not held (yet). */
  notHeld: number;
  cancelled: number;
  moved: number;
  cancelledReasons: string[];
  movedReasons: string[];
}

const MAX_REASONS = 5;
const MAX_REASON_LENGTH = 140;

const clean = (reasons: ReadonlyArray<string | undefined>): string[] => {
  const seen = new Set<string>();
  for (const r of reasons) {
    const t = r?.replace(/\s+/g, " ").trim();
    if (t) seen.add(t.length > MAX_REASON_LENGTH ? `${t.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…` : t);
  }
  return [...seen].slice(0, MAX_REASONS);
};

/** Undefined when nothing was planned for the period: a project without a plan reports exactly as before. */
export function summarizePlanDelivery(items: ReadonlyArray<PlanDeliveryItem>, period: { start: PlainDate; end: PlainDate }): PlanDeliverySummary | undefined {
  const inPeriod = items.filter((i) => compareDates(i.plannedEnd, period.start) >= 0 && compareDates(i.plannedEnd, period.end) <= 0);
  const live = inPeriod.filter((i) => i.status !== "CANCELLED");
  const cancelled = inPeriod.filter((i) => i.status === "CANCELLED");
  if (live.length === 0 && cancelled.length === 0) return undefined;
  const held = live.filter((i) => i.status === "DONE").length;
  const moved = live.filter((i) => i.moved);
  return {
    planned: live.length,
    held,
    notHeld: live.length - held,
    cancelled: cancelled.length,
    moved: moved.length,
    cancelledReasons: clean(cancelled.map((i) => i.reason)),
    movedReasons: clean(moved.map((i) => i.reason)),
  };
}

/** The statements a report may restate (plain sentences; no dates, so nothing needs date grounding). */
export function planDeliverySentences(s: PlanDeliverySummary): string[] {
  const out: string[] = [];
  if (s.planned > 0) out.push(`${s.planned} activities were planned for this period and ${s.held} were held.`);
  if (s.planned > 0 && s.notHeld > 0) out.push(`${s.notHeld} of the ${s.planned} planned activities were not held in this period.`);
  if (s.planned > 0 && s.notHeld === 0) out.push(`All ${s.planned} planned activities were held.`);
  if (s.moved > 0) out.push(`${s.moved} planned activities were moved to different dates.`);
  if (s.cancelled > 0) out.push(`${s.cancelled} planned activities were cancelled.`);
  for (const r of s.movedReasons) out.push(`Reason recorded for a moved activity: ${r}`);
  for (const r of s.cancelledReasons) out.push(`Reason recorded for a cancelled activity: ${r}`);
  return out;
}

/** What "Tell the story" may offer, only for fields the officer left empty. */
export interface PlanStorySuggestion {
  challenges?: string;
  varianceExplanations?: string;
}

export function suggestStoryFromPlan(s: PlanDeliverySummary | undefined): PlanStorySuggestion {
  if (!s) return {};
  const out: PlanStorySuggestion = {};
  if (s.notHeld > 0) out.challenges = `${s.notHeld} of the ${s.planned} activities planned for this period were not held.`;
  const why = [...s.movedReasons.map((r) => `Moved: ${r}`), ...s.cancelledReasons.map((r) => `Cancelled: ${r}`)];
  if (why.length > 0) out.varianceExplanations = why.join("\n");
  return out;
}
