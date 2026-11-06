/**
 * How a project stands, in three plain labels with the two biggest reasons. Worked out from what the plan and the collection of
 * indicator values already say (the same rules as the lists), never from a separate score. No number is shown to people.
 */
import { countOf } from "../../core/plural.js";

export type HealthBand = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_PLAN";

export const HEALTH_BAND_LABEL: Readonly<Record<HealthBand, string>> = {
  ON_TRACK: "On track",
  AT_RISK: "Needs attention",
  OFF_TRACK: "Behind",
  NO_PLAN: "No plan yet",
};

/** One table for the thresholds, so changing what "behind" means is one edit. */
export const HEALTH_THRESHOLDS = {
  /** This share of the planned activities late, or this many, or this many overdue values: behind. */
  offTrackLateShare: 0.25,
  offTrackLateCount: 5,
  offTrackOverdueValues: 3,
} as const;

export interface HealthPlanRow { status: string; state: string }

export interface DeliveryHealth {
  /** Planned and not cancelled. */
  planned: number;
  done: number;
  doneLate: number;
  /** Still open and past its end date. */
  overdue: number;
  /** Open and should have started. */
  lateStart: number;
  dueSoon: number;
  /** Indicator values past their due date. */
  valuesOverdue: number;
  valuesDue: number;
  /** Values already recorded: there is something being tracked even when nothing is planned. */
  valuesRecorded: number;
  /** done on time of done (null when nothing is done). */
  onTimeRate: number | null;
}

export function deliveryHealth(rows: ReadonlyArray<HealthPlanRow>, collection: { overdue: number; due: number; recorded?: number }): DeliveryHealth {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const done = live.filter((r) => r.status === "DONE");
  const doneLate = done.filter((r) => r.state === "DONE_LATE").length;
  return {
    planned: live.length,
    done: done.length,
    doneLate,
    overdue: live.filter((r) => r.state === "OVERDUE").length,
    lateStart: live.filter((r) => r.state === "LATE_START").length,
    dueSoon: live.filter((r) => r.state === "DUE_SOON").length,
    valuesOverdue: collection.overdue,
    valuesDue: collection.due,
    valuesRecorded: collection.recorded ?? 0,
    onTimeRate: done.length === 0 ? null : (done.length - doneLate) / done.length,
  };
}

export const lateActivities = (h: DeliveryHealth): number => h.overdue + h.lateStart;

export function healthBand(h: DeliveryHealth): HealthBand {
  if (h.planned === 0 && h.valuesOverdue === 0 && h.valuesDue === 0 && h.valuesRecorded === 0) return "NO_PLAN";
  const late = lateActivities(h);
  const t = HEALTH_THRESHOLDS;
  if ((h.planned > 0 && late / h.planned >= t.offTrackLateShare) || late >= t.offTrackLateCount || h.valuesOverdue >= t.offTrackOverdueValues) return "OFF_TRACK";
  if (late >= 1 || h.valuesOverdue >= 1) return "AT_RISK";
  return "ON_TRACK";
}

/** The two biggest reasons, in words ("4 activities late · 2 indicator values overdue"); nothing late reads as such. */
export function healthReasons(h: DeliveryHealth, limit = 2): string[] {
  const candidates: Array<{ n: number; text: string }> = [
    { n: lateActivities(h), text: `${countOf(lateActivities(h), "activity", "activities")} late` },
    { n: h.valuesOverdue, text: `${countOf(h.valuesOverdue, "indicator value")} overdue` },
    { n: h.valuesDue, text: `${countOf(h.valuesDue, "indicator value")} due` },
    { n: h.dueSoon, text: `${countOf(h.dueSoon, "activity", "activities")} starting within a week` },
  ];
  const picked = candidates.filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, limit).map((c) => c.text);
  return picked.length > 0 ? picked : h.planned > 0 || h.valuesDue > 0 || h.valuesRecorded > 0 ? ["Nothing is late"] : [];
}
