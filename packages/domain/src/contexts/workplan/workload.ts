/**
 * Workload per person per week (phase 28.1-J): how many open planned activities a person leads in each week, against how many
 * they can take. Counted in activities, not hours: the app does not record hours, so no hours are invented. An overload is a
 * signal shown beside the week, never a block.
 */
import { addDays, daysBetween, type PlainDate } from "./plain-date.js";

export const WORKLOAD_WEEKS = 8;
export const MAX_CAPACITY = 30;

/** The Monday of the week a date falls in. */
export function weekStartOf(date: PlainDate): PlainDate {
  // 1970-01-01 was a Thursday: Monday-based index 0..6.
  const dow = ((daysBetween("1970-01-01", date) + 3) % 7 + 7) % 7;
  return addDays(date, -dow);
}

/** The Mondays of the next `count` weeks, starting with the week of `today`. */
export function upcomingWeeks(today: PlainDate, count = WORKLOAD_WEEKS): PlainDate[] {
  const first = weekStartOf(today);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

export interface WorkloadItem {
  ownerUserId?: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  status: string;
}

/** Open activities (not done, not cancelled) the person leads that overlap the week. */
export function loadInWeek(items: ReadonlyArray<WorkloadItem>, userId: string, weekStart: PlainDate): number {
  const weekEnd = addDays(weekStart, 6);
  return items.filter((i) => i.ownerUserId === userId && (i.status === "PLANNED" || i.status === "IN_PROGRESS")
    && i.plannedStart <= weekEnd && i.plannedEnd >= weekStart).length;
}

export interface WorkloadCell { weekStart: PlainDate; load: number; capacity: number | null; over: boolean }
export interface WorkloadRow { userId: string; capacity: number | null; weeks: WorkloadCell[] }

export function workloadGrid(
  items: ReadonlyArray<WorkloadItem>,
  people: ReadonlyArray<{ userId: string; capacity: number | null }>,
  weeks: ReadonlyArray<PlainDate>,
): WorkloadRow[] {
  return people.map((p) => ({
    userId: p.userId,
    capacity: p.capacity,
    weeks: weeks.map((w) => {
      const load = loadInWeek(items, p.userId, w);
      return { weekStart: w, load, capacity: p.capacity, over: p.capacity !== null && load > p.capacity };
    }),
  }));
}

/** A capacity is a whole number of activities a week, from 1 to MAX_CAPACITY, or blank (no limit set). */
export function parseCapacity(text: string | null | undefined): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = (text ?? "").trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CAPACITY) return { ok: false, message: `Enter a whole number from 1 to ${MAX_CAPACITY}, or leave it blank` };
  return { ok: true, value: n };
}


