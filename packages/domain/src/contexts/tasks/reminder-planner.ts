/**
 * The daily summary and the escalation, planned as pure functions: who hears what, in words, and when. Nothing is sent here.
 * A quiet day plans nothing. The only setting is the person's choice of mail: daily summary (default), only urgent, or never.
 */
import { countOf } from "../../core/plural.js";
import { isValidTimeZone } from "../../core/time-zone.js";
import type { PlainDate } from "../workplan/plain-date.js";
import type { Assignment } from "./assignment-model.js";
import { SEND_HOUR_LOCAL, daysLate, reminderText, shouldEscalate, summaryRuleOf, type ReminderRuleKey } from "./reminder-rules.js";

export type SummaryMode = "DAILY_SUMMARY" | "URGENT_ONLY" | "NEVER";
export const SUMMARY_MODES: SummaryMode[] = ["DAILY_SUMMARY", "URGENT_ONLY", "NEVER"];
export const SUMMARY_MODE_LABEL: Readonly<Record<SummaryMode, string>> = {
  DAILY_SUMMARY: "Daily summary",
  URGENT_ONLY: "Only urgent things",
  NEVER: "Never",
};
export function isSummaryMode(value: unknown): value is SummaryMode {
  return typeof value === "string" && (SUMMARY_MODES as string[]).includes(value);
}

/**
 * May we email this person right now? "Never" means no mail at all (the in-app note is still made); "Only urgent" means only
 * what is marked urgent or late; the default sends the summary and a new request.
 */
export function emailAllowed(mode: SummaryMode, urgent: boolean): boolean {
  if (mode === "NEVER") return false;
  return mode === "DAILY_SUMMARY" || urgent;
}

export interface SummaryLine {
  key: string;
  rule: ReminderRuleKey;
  urgent: boolean;
  text: string;
}

/** One person's lines for today, most pressing first. */
export function summaryLines(assignments: ReadonlyArray<Assignment>, today: PlainDate): SummaryLine[] {
  const order: Record<ReminderRuleKey, number> = { LATE: 0, DUE_TODAY: 1, DUE_SOON: 2, ESCALATE: 3 };
  return assignments
    .flatMap((a) => {
      const rule = summaryRuleOf(a, today);
      return rule ? [{ a, rule }] : [];
    })
    .sort((x, y) => order[x.rule] - order[y.rule] || (x.a.dueDate ?? "").localeCompare(y.a.dueDate ?? "") || x.a.title.localeCompare(y.a.title) || x.a.key.localeCompare(y.a.key))
    .map(({ a, rule }) => ({ key: a.key, rule, urgent: a.urgent || rule === "LATE", text: reminderText(a, rule, today) }));
}

/** "Only urgent": what is late, due today, or marked urgent. "Never": nothing. */
export function applyMode(lines: ReadonlyArray<SummaryLine>, mode: SummaryMode): SummaryLine[] {
  if (mode === "NEVER") return [];
  if (mode === "DAILY_SUMMARY") return [...lines];
  return lines.filter((l) => l.urgent || l.rule === "DUE_TODAY");
}

export interface RenderedSummary { title: string; message: string }

/** Words for the notification and the email. Null on a quiet day. */
export function renderSummary(lines: ReadonlyArray<SummaryLine>): RenderedSummary | null {
  if (lines.length === 0) return null;
  const late = lines.filter((l) => l.rule === "LATE").length;
  const today = lines.filter((l) => l.rule === "DUE_TODAY").length;
  const parts = [late > 0 ? `${late} late` : "", today > 0 ? `${today} due today` : ""].filter(Boolean);
  const title = `${countOf(lines.length, "thing needs", "things need")} you today${parts.length ? ` (${parts.join(", ")})` : ""}`;
  const section = (heading: string, rule: ReminderRuleKey) => {
    const mine = lines.filter((l) => l.rule === rule);
    return mine.length ? [`${heading}`, ...mine.map((l) => `- ${l.text}`)] : [];
  };
  return { title, message: [...section("Late", "LATE"), ...section("Due today", "DUE_TODAY"), ...section("Coming up", "DUE_SOON")].join("\n") };
}

export interface Escalation {
  /** The project's manager, who is told. */
  recipientId: string;
  /** Once per assignment. */
  subjectKey: string;
  title: string;
  message: string;
}

/**
 * Work a week late is told once to the project's manager (not to the person: they already see it). No manager, or the
 * manager is the one who is late, means nobody is told; the person's own summary still shows it.
 */
export function planEscalations(
  assignments: ReadonlyArray<Assignment>,
  today: PlainDate,
  managerOf: (projectId: string) => string | undefined,
  nameOf: (userId: string) => string,
  alreadyTold: (recipientId: string, subjectKey: string) => boolean,
): Escalation[] {
  const out: Escalation[] = [];
  for (const a of assignments) {
    if (!shouldEscalate(a, today)) continue;
    const manager = managerOf(a.projectId);
    if (!manager || manager === a.assigneeId || alreadyTold(manager, a.key)) continue;
    out.push({
      recipientId: manager, subjectKey: a.key, title: `${nameOf(a.assigneeId)} is ${countOf(daysLate(a, today), "day")} late`,
      message: `${a.title} (${a.projectTitle}) was due ${a.dueDate}. ${nameOf(a.assigneeId)} is responsible for it.`,
    });
  }
  return out.sort((x, y) => x.recipientId.localeCompare(y.recipientId) || x.subjectKey.localeCompare(y.subjectKey));
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function parts(now: Date, timeZone: string): { date: PlainDate; hour: number } {
  let f = FORMATTERS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
    FORMATTERS.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}


/** The organisation's calendar day right now (an unknown zone reads as UTC). */
export function localDate(now: Date, timeZone: string): PlainDate {
  return parts(now, isValidTimeZone(timeZone) ? timeZone : "UTC").date;
}

/** True during the 07:00 hour in the organisation's time zone: the hourly timer sends then and not otherwise. */
export function isSendHour(now: Date, timeZone: string, hour = SEND_HOUR_LOCAL): boolean {
  return parts(now, isValidTimeZone(timeZone) ? timeZone : "UTC").hour === hour;
}

