/**
 * Progress log for a planned activity (phase 28.1 gap closure). A person records what happened day by day, week by week, or
 * month by month, then the activity-end report. Rules:
 * - Blank stays blank: an unrecorded figure is null, never 0.
 * - One live entry covers each day. A monthly report absorbs the daily and weekly entries inside its month, so they are never
 *   added twice. A week may not cross a month end (its days belong to two monthly reports otherwise).
 * - Monthly and activity-end forms are prefilled from the live entries they cover. A figure nobody recorded stays blank.
 * - Breakdown fields are the ones the activity's linked indicators need (`progressFields`), each shown once.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { addDays, compareDates, isPlainDate, type PlainDate } from "./plain-date.js";

export const PROGRESS_KINDS = ["DAILY", "WEEKLY", "MONTHLY", "END"] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];
export const PROGRESS_KIND_LABEL: Readonly<Record<ProgressKind, string>> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", END: "Activity end" };

/** A breakdown the activity reports on: its key (dimension|category), label, and the indicator codes that need it. */
export interface ProgressField { key: string; label: string; usedBy: string[] }

export interface ProgressIndicator { code: string; targetBreakdowns: ReadonlyArray<{ dimension: string; category: string }> }

/** The breakdown fields for the indicators an activity is linked to: each distinct breakdown once, in order. */
export function progressFields(indicators: ReadonlyArray<ProgressIndicator>): ProgressField[] {
  const byKey = new Map<string, ProgressField>();
  for (const ind of indicators) {
    for (const b of ind.targetBreakdowns) {
      const key = breakdownKey(b.dimension, b.category);
      const existing = byKey.get(key);
      if (existing) { if (!existing.usedBy.includes(ind.code)) existing.usedBy.push(ind.code); }
      else byKey.set(key, { key, label: `${b.category}`, usedBy: [ind.code] });
    }
  }
  return [...byKey.values()];
}

export const breakdownKey = (dimension: string, category: string): string => `${dimension}|${category.trim().toLowerCase()}`;

/** The numbers a progress entry can hold: the total, every breakdown field, sessions, and unique people (end report). */
export interface ProgressValues {
  total: number | null;
  breakdowns: Record<string, number | null>;
  sessions: number | null;
  unique: number | null;
}

export interface ProgressNarrative { notes: string; summary: string; achievements: string; challenges: string; nextSteps: string; lessons: string }

export const blankValues = (fields: ReadonlyArray<ProgressField>): ProgressValues => ({
  total: null, breakdowns: Object.fromEntries(fields.map((f) => [f.key, null])), sessions: null, unique: null,
});

export interface LiveEntry { id: string; kind: ProgressKind; from: PlainDate; to: PlainDate; values: ProgressValues; absorbedById: string | null }

/** The dates an entry covers, clipped to the activity. Returns an error for a choice outside the activity or a week that crosses a month. */
export function progressRange(kind: ProgressKind, key: string, activity: { start: PlainDate; end: PlainDate }): Result<{ from: PlainDate; to: PlainDate }> {
  if (kind === "END") return ok({ from: activity.start, to: activity.end });
  if (kind === "MONTHLY") {
    if (!/^\d{4}-\d{2}$/.test(key)) return err(DomainError.validation("Choose the month", { field: "key" }));
    const from = `${key}-01`;
    const [y, m] = key.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to = addDays(next, -1);
    const clampedFrom = compareDates(from, activity.start) < 0 ? activity.start : from;
    const clampedTo = compareDates(to, activity.end) > 0 ? activity.end : to;
    if (compareDates(clampedFrom, clampedTo) > 0) return err(DomainError.validation("That month is outside the activity dates", { field: "key" }));
    return ok({ from: clampedFrom, to: clampedTo });
  }
  if (!isPlainDate(key)) return err(DomainError.validation(kind === "WEEKLY" ? "Choose the first day of the week" : "Choose the date", { field: "key" }));
  if (kind === "DAILY") {
    if (compareDates(key, activity.start) < 0 || compareDates(key, activity.end) > 0) return err(DomainError.validation("Pick a day inside the activity dates", { field: "key" }));
    return ok({ from: key, to: key });
  }
  const from = compareDates(key, activity.start) < 0 ? activity.start : key;
  const weekEnd = addDays(key, 6);
  const to = compareDates(weekEnd, activity.end) > 0 ? activity.end : weekEnd;
  if (compareDates(from, to) > 0) return err(DomainError.validation("That week is outside the activity dates", { field: "key" }));
  if (from.slice(0, 7) !== to.slice(0, 7)) return err(DomainError.validation("This week runs into the next month. Log those days as daily entries, or pick a week inside one month", { field: "key" }));
  return ok({ from, to });
}

/** The live entries a new entry of this kind and range would use (monthly: the daily and weekly inside it; end: everything). */
export function sourcesFor(kind: ProgressKind, range: { from: PlainDate; to: PlainDate }, live: ReadonlyArray<LiveEntry>): LiveEntry[] {
  if (kind === "MONTHLY") return live.filter((e) => (e.kind === "DAILY" || e.kind === "WEEKLY") && compareDates(e.from, range.from) >= 0 && compareDates(e.to, range.to) <= 0);
  if (kind === "END") return [...live];
  return [];
}

/** A figure is the sum of what was recorded; nothing recorded is null (blank), never zero. */
export function sumValues(sources: ReadonlyArray<LiveEntry>, fields: ReadonlyArray<ProgressField>): ProgressValues {
  const sum = (pick: (v: ProgressValues) => number | null): number | null => {
    const xs = sources.map((s) => pick(s.values)).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  };
  return {
    total: sum((v) => v.total),
    breakdowns: Object.fromEntries(fields.map((f) => [f.key, sum((v) => v.breakdowns[f.key] ?? null)])),
    sessions: sum((v) => v.sessions),
    unique: null,
  };
}

/** Two live entries may not cover the same day. Absorbed daily and weekly entries do not count; the monthly report that absorbed them does. */
export function overlapping(live: ReadonlyArray<LiveEntry>, kind: ProgressKind, range: { from: PlainDate; to: PlainDate }, exceptId?: string): LiveEntry | undefined {
  if (kind === "END") return undefined;
  return live.find((e) => e.id !== exceptId && e.kind !== "END" && e.absorbedById === null
    && compareDates(e.from, range.to) <= 0 && compareDates(e.to, range.from) >= 0
    && (kind !== "MONTHLY" || e.kind === "MONTHLY"));
}

/** A typed figure: blank is null; otherwise a whole number, zero or more. */
export function parseCount(text: string | null | undefined): Result<number | null> {
  const t = (text ?? "").trim();
  if (t === "") return ok(null);
  if (!/^\d+$/.test(t)) return err(DomainError.validation("Enter a whole number, or leave it blank"));
  return ok(Number(t));
}

