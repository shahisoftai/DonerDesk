/**
 * Where a planned activity stands, derived and never stored. Granular states exist for rules, reminders and tests;
 * a person sees one signal (`deliverySignal`): On time, Late, Done or Cancelled, with the reason in the tooltip.
 *
 * The rules are an ordered table: the first that applies wins. A milestone (start = end) goes through the same
 * table with no special case.
 */
import { addDays, compareDates, daysBetween, formatShortDate, type PlainDate } from "./plain-date.js";
import type { PlanStatus } from "./plan-status-transitions.js";

export type DeliveryState = "UPCOMING" | "DUE_SOON" | "IN_PROGRESS" | "LATE_START" | "OVERDUE" | "DONE" | "DONE_LATE" | "CANCELLED";
export type DeliverySignal = "ON_TIME" | "LATE" | "DONE" | "CANCELLED";

export const DELIVERY_STATES: DeliveryState[] = ["UPCOMING", "DUE_SOON", "IN_PROGRESS", "LATE_START", "OVERDUE", "DONE", "DONE_LATE", "CANCELLED"];

/** Days before the start date in which an activity is "due soon". */
export const DUE_SOON_DAYS = 7;

export interface DeliveryItem {
  status: PlanStatus;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  completedOn?: PlainDate;
}

/** Completed activities linked to the planned activity (withdrawn ones already left out, `isLiveActivity`). */
export interface DeliveryFacts {
  liveRecords: number;
  acceptedRecords: number;
  firstRecordDate?: PlainDate;
  lastRecordDate?: PlainDate;
  deliveredCount: number;
}

export const NO_DELIVERY: DeliveryFacts = { liveRecords: 0, acceptedRecords: 0, deliveredCount: 0 };

interface RuleInput {
  item: DeliveryItem;
  facts: DeliveryFacts;
  today: PlainDate;
  started: boolean;
}

export const DELIVERY_STATE_RULES: ReadonlyArray<{ state: DeliveryState; applies: (i: RuleInput) => boolean }> = [
  { state: "CANCELLED", applies: ({ item }) => item.status === "CANCELLED" },
  { state: "DONE_LATE", applies: ({ item, today }) => item.status === "DONE" && compareDates(item.completedOn ?? today, item.plannedEnd) > 0 },
  { state: "DONE", applies: ({ item }) => item.status === "DONE" },
  { state: "OVERDUE", applies: ({ item, today }) => compareDates(today, item.plannedEnd) > 0 },
  { state: "LATE_START", applies: ({ item, today, started }) => !started && compareDates(today, item.plannedStart) > 0 },
  { state: "IN_PROGRESS", applies: ({ started }) => started },
  { state: "DUE_SOON", applies: ({ item, today }) => compareDates(item.plannedStart, addDays(today, DUE_SOON_DAYS)) <= 0 },
  { state: "UPCOMING", applies: () => true },
];

export function deliveryState(item: DeliveryItem, facts: DeliveryFacts, today: PlainDate): DeliveryState {
  const input: RuleInput = { item, facts, today, started: item.status === "IN_PROGRESS" || facts.liveRecords > 0 };
  return DELIVERY_STATE_RULES.find((r) => r.applies(input))!.state;
}

export const DELIVERY_SIGNAL: Readonly<Record<DeliveryState, DeliverySignal>> = {
  UPCOMING: "ON_TIME",
  DUE_SOON: "ON_TIME",
  IN_PROGRESS: "ON_TIME",
  LATE_START: "LATE",
  OVERDUE: "LATE",
  DONE: "DONE",
  DONE_LATE: "DONE",
  CANCELLED: "CANCELLED",
};

export const DELIVERY_SIGNAL_LABEL: Readonly<Record<DeliverySignal, string>> = {
  ON_TIME: "On time",
  LATE: "Late",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export function deliverySignal(state: DeliveryState): DeliverySignal {
  return DELIVERY_SIGNAL[state];
}

const DELIVERY_REASON: Readonly<Record<DeliveryState, (item: DeliveryItem, today: PlainDate) => string | undefined>> = {
  UPCOMING: (item, today) => `starts ${formatShortDate(item.plannedStart, today)}`,
  DUE_SOON: (item, today) => `starts ${formatShortDate(item.plannedStart, today)}`,
  IN_PROGRESS: (item, today) => `ends ${formatShortDate(item.plannedEnd, today)}`,
  LATE_START: (item, today) => `started late: was due to start ${formatShortDate(item.plannedStart, today)}`,
  OVERDUE: (item, today) => `past its end date ${formatShortDate(item.plannedEnd, today)}`,
  DONE: () => undefined,
  DONE_LATE: (item, today) => {
    const late = daysBetween(item.plannedEnd, item.completedOn ?? today);
    return `done ${late} ${late === 1 ? "day" : "days"} late`;
  },
  CANCELLED: () => undefined,
};

/** The tooltip line beside the signal ("past its end date 3 Mar", "done 4 days late"). */
export function deliveryReason(state: DeliveryState, item: DeliveryItem, today: PlainDate): string | undefined {
  return DELIVERY_REASON[state](item, today);
}
