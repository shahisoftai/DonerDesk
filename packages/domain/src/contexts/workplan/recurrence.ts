/**
 * Repeating planned activities. A person chooses only "Repeats: no / every week / every month, until <date>"; the
 * rule keeps a general shape for the code. Occurrences become real rows (each can be assigned, moved or cancelled).
 */
import { addDays, addMonths, compareDates, daysBetween, isPlainDate, type PlainDate } from "./plain-date.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export type RecurrenceUnit = "WEEK" | "MONTH";

export interface RecurrenceRule {
  every: RecurrenceUnit;
  interval: number;
  until: PlainDate;
}

export interface Occurrence {
  start: PlainDate;
  end: PlainDate;
}

/** Never more rows than this from one rule (10 years of months). */
export const MAX_OCCURRENCES = 120;

const STEP: Readonly<Record<RecurrenceUnit, (start: PlainDate, n: number, anchorDay: number) => PlainDate>> = {
  WEEK: (start, n) => addDays(start, 7 * n),
  MONTH: (start, n, anchorDay) => addMonths(start, n, anchorDay),
};

export function validateRecurrence(rule: RecurrenceRule, start: PlainDate): Result<RecurrenceRule> {
  if (!Number.isInteger(rule.interval) || rule.interval < 1) return err(DomainError.validation("A repeat must be every 1 or more weeks or months"));
  if (!isPlainDate(rule.until)) return err(DomainError.validation("Choose the date the repeats end"));
  if (compareDates(rule.until, start) < 0) return err(DomainError.validation("The repeats must end on or after the first date"));
  return ok(rule);
}

/** First occurrence included; each keeps the first one's length; the last one starts on or before `until`. */
export function expandRecurrence(rule: RecurrenceRule, first: Occurrence): { occurrences: Occurrence[]; capped: boolean } {
  const length = daysBetween(first.start, first.end);
  const anchorDay = Number(first.start.slice(8, 10));
  const occurrences: Occurrence[] = [];
  for (let n = 0; ; n += 1) {
    const start = STEP[rule.every](first.start, n * rule.interval, anchorDay);
    if (compareDates(start, rule.until) > 0) return { occurrences, capped: false };
    if (occurrences.length === MAX_OCCURRENCES) return { occurrences, capped: true };
    occurrences.push({ start, end: addDays(start, length) });
  }
}
