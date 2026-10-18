/**
 * When to remind, as one exhaustive table over the kinds of assignment (add a kind = add a row): due within 3 days and due today
 * go in the daily summary, late goes in the summary every day, and late for a week goes once to the project manager. Things that
 * arrive only because of a person's role (files to check, reviews) and things with no date never remind: they live in My Work.
 */
import { addDays, compareDates, daysBetween, formatShortDate, type PlainDate } from "../workplan/plain-date.js";
import type { Assignment, AssignmentKind } from "./assignment-model.js";

export type ReminderRuleKey = "DUE_SOON" | "DUE_TODAY" | "LATE" | "ESCALATE";
export const REMINDER_RULE_KEYS: ReminderRuleKey[] = ["DUE_SOON", "DUE_TODAY", "LATE", "ESCALATE"];

/** "Due in 3 days" is the day the summary starts to mention a deadline. */
export const SOON_DAYS = 3;
/** A week late and the project manager hears about it, once. */
export const ESCALATE_AFTER_DAYS = 7;
/** The summary goes out at this hour in the organisation's time zone. */
export const SEND_HOUR_LOCAL = 7;

const ALL: ReadonlyArray<ReminderRuleKey> = ["DUE_SOON", "DUE_TODAY", "LATE", "ESCALATE"];

export const REMINDER_RULES: Readonly<Record<AssignmentKind, ReadonlyArray<ReminderRuleKey>>> = {
  PLAN_ITEM: ALL,
  TASK: ALL,
  CHECKLIST_ITEM: ALL,
  REPORT_DEADLINE: ALL,
  INDICATOR_VALUE: ALL,
  ACTIVITY_FIX: [],
  EVIDENCE_REVIEW: [],
  ACTIVITY_REVIEW: [],
};

/** Whole days past the due date (0 when not past). */
export function daysLate(a: Pick<Assignment, "dueDate">, today: PlainDate): number {
  return a.dueDate && compareDates(a.dueDate, today) < 0 ? daysBetween(a.dueDate, today) : 0;
}

/** The rule that puts this assignment in today's summary, if any. */
export function summaryRuleOf(a: Pick<Assignment, "kind" | "dueDate" | "state">, today: PlainDate): ReminderRuleKey | undefined {
  const rules = REMINDER_RULES[a.kind];
  if (a.state === "LATE" && rules.includes("LATE")) return "LATE";
  if (!a.dueDate) return undefined;
  if (a.dueDate === today && rules.includes("DUE_TODAY")) return "DUE_TODAY";
  if (compareDates(a.dueDate, today) > 0 && compareDates(a.dueDate, addDays(today, SOON_DAYS)) <= 0 && rules.includes("DUE_SOON")) return "DUE_SOON";
  return undefined;
}

export function shouldEscalate(a: Pick<Assignment, "kind" | "dueDate" | "state">, today: PlainDate): boolean {
  return REMINDER_RULES[a.kind].includes("ESCALATE") && a.state === "LATE" && daysLate(a, today) >= ESCALATE_AFTER_DAYS;
}

export function reminderText(a: Pick<Assignment, "title" | "projectTitle" | "dueDate">, rule: ReminderRuleKey, today: PlainDate): string {
  const when =
    rule === "DUE_TODAY" ? "due today"
    : rule === "DUE_SOON" && a.dueDate ? `due ${formatShortDate(a.dueDate, today)}`
    : a.dueDate ? `was due ${formatShortDate(a.dueDate, today)}` : "late";
  return `${a.title} (${a.projectTitle}): ${when}`;
}
