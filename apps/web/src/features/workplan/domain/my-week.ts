/**
 * My week for a field officer: what is late, what is this week, what is next week. Pure; the server has already limited the
 * list to the person's own open activities.
 */
import { addDays, compareDates, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";
import { startOfWeek } from "./plan-list-view.ts";

export type MyWeekSection = "LATE" | "THIS_WEEK" | "NEXT_WEEK";
export const MY_WEEK_LABEL: Readonly<Record<MyWeekSection, string>> = { LATE: "Late", THIS_WEEK: "This week", NEXT_WEEK: "Next week" };

export interface MyWeekRow {
  id: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED";
}

export interface MyWeekGroup<T extends MyWeekRow> { key: MyWeekSection; label: string; items: T[] }

export function groupMyWeek<T extends MyWeekRow>(rows: ReadonlyArray<T>, today: PlainDate): MyWeekGroup<T>[] {
  const thisWeekEnd = addDays(startOfWeek(today), 6);
  const nextWeekEnd = addDays(thisWeekEnd, 7);
  const sectionOf = (r: T): MyWeekSection | undefined => {
    if (r.signal === "LATE") return "LATE";
    if (compareDates(r.plannedStart, thisWeekEnd) <= 0) return "THIS_WEEK";
    if (compareDates(r.plannedStart, nextWeekEnd) <= 0) return "NEXT_WEEK";
    return undefined; // later than next week: not part of "my week"
  };
  const keys: MyWeekSection[] = ["LATE", "THIS_WEEK", "NEXT_WEEK"];
  return keys
    .map((key) => ({ key, label: MY_WEEK_LABEL[key], items: rows.filter((r) => sectionOf(r) === key).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.id.localeCompare(b.id)) }))
    .filter((g) => g.items.length > 0);
}

/** My week replaces nothing: it appears on Home only for a role that lands on it, and only once the person has planned work. */
export function shouldShowMyWeek(home: "MY_WEEK" | "DEFAULT", plannedCount: number): boolean {
  return home === "MY_WEEK" && plannedCount > 0;
}
