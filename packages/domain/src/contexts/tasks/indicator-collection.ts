/**
 * When an indicator's value is due, and from whom. A value is due a few days after its period ends (5 by default, a setting on
 * the reporting profile). An indicator that is not due this period is never "missing" (`isDueInPeriod`); a value already
 * recorded is always fine. Pure: today and every fact are passed in.
 */
import { isDueInPeriod } from "../reporting/indicator-frequency.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { addDays, compareDates, type PlainDate } from "../workplan/plain-date.js";

export type CollectionState = "RECORDED" | "DUE" | "OVERDUE" | "NOT_DUE";

export const DEFAULT_ENTRY_DUE_DAYS = 5;
/** A project may allow up to two months after a period ends; longer is no longer "due". */
export const MAX_ENTRY_DUE_DAYS = 60;

/** The days a project allows for indicator values after a period ends: a whole number from 0 to 60. */
export function checkEntryDueDays(value: unknown): Result<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_ENTRY_DUE_DAYS) {
    return err(DomainError.validation(`Enter a whole number of days from 0 to ${MAX_ENTRY_DUE_DAYS}`, { field: "days" }));
  }
  return ok(value);
}

export interface CollectionIndicator {
  id: string;
  code: string;
  name: string;
  frequency?: string | null | undefined;
  responsibleUserId?: string | null | undefined;
}

export interface CollectionPeriod {
  id: string;
  start: PlainDate;
  end: PlainDate;
  /** The closing period of the project: every indicator is due in it. */
  isFinal: boolean;
}

const asDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);

export interface CollectionDue {
  indicatorId: string;
  periodId: string;
  dueBy: PlainDate;
  state: CollectionState;
}

export function collectionDue(input: {
  indicator: CollectionIndicator;
  period: CollectionPeriod;
  projectStart: PlainDate;
  hasValue: boolean;
  today: PlainDate;
  dueDays?: number;
}): CollectionDue {
  const dueBy = addDays(input.period.end, input.dueDays ?? DEFAULT_ENTRY_DUE_DAYS);
  const base = { indicatorId: input.indicator.id, periodId: input.period.id, dueBy };
  if (input.hasValue) return { ...base, state: "RECORDED" };
  const expected = isDueInPeriod(input.indicator.frequency, { projectStart: asDate(input.projectStart), periodEnd: asDate(input.period.end) }, { isFinalPeriod: input.period.isFinal });
  if (!expected) return { ...base, state: "NOT_DUE" };
  // A period still running has nothing to report yet.
  if (compareDates(input.today, input.period.end) <= 0) return { ...base, state: "NOT_DUE" };
  return { ...base, state: compareDates(input.today, dueBy) <= 0 ? "DUE" : "OVERDUE" };
}

/** Who collects an indicator's values: its lead, else the project's M&E officer, else its manager. */
export function collectionOwner(indicator: Pick<CollectionIndicator, "responsibleUserId">, project: { meOfficerId?: string | null | undefined; projectManagerId?: string | null | undefined }): string | undefined {
  return indicator.responsibleUserId || project.meOfficerId || project.projectManagerId || undefined;
}

export interface CollectionInput {
  projectStart: PlainDate;
  dueDays?: number;
  indicators: ReadonlyArray<CollectionIndicator>;
  periods: ReadonlyArray<CollectionPeriod>;
  /** "indicatorId|periodId" for every value that is recorded. */
  recorded: ReadonlySet<string>;
  today: PlainDate;
}

export const recordedKey = (indicatorId: string, periodId: string) => `${indicatorId}|${periodId}`;

/** Every (indicator, period) that is due or overdue now: what the project is waiting for. */
export function openCollection(input: CollectionInput): Array<CollectionDue & { indicator: CollectionIndicator }> {
  const out: Array<CollectionDue & { indicator: CollectionIndicator }> = [];
  for (const indicator of input.indicators) {
    for (const period of input.periods) {
      const due = collectionDue({ indicator, period, projectStart: input.projectStart, hasValue: input.recorded.has(recordedKey(indicator.id, period.id)), today: input.today, ...(input.dueDays !== undefined ? { dueDays: input.dueDays } : {}) });
      if (due.state === "DUE" || due.state === "OVERDUE") out.push({ ...due, indicator });
    }
  }
  return out.sort((a, b) => a.dueBy.localeCompare(b.dueBy) || a.indicator.code.localeCompare(b.indicator.code));
}

export interface CollectionSummary {
  overdue: number;
  due: number;
  recorded: number;
}

/** How the project's indicator values stand: how many are overdue, due now, and already recorded (what is "tracked"). */
export function collectionSummary(input: CollectionInput): CollectionSummary {
  const summary: CollectionSummary = { overdue: 0, due: 0, recorded: 0 };
  for (const indicator of input.indicators) {
    for (const period of input.periods) {
      const d = collectionDue({ indicator, period, projectStart: input.projectStart, hasValue: input.recorded.has(recordedKey(indicator.id, period.id)), today: input.today, ...(input.dueDays !== undefined ? { dueDays: input.dueDays } : {}) });
      if (d.state === "OVERDUE") summary.overdue += 1;
      else if (d.state === "DUE") summary.due += 1;
      else if (d.state === "RECORDED") summary.recorded += 1;
    }
  }
  return summary;
}
