/**
 * The calendar inside My week: seven days, or a month grid of Monday-first weeks. Pure: each cell lists the planned
 * activities that cover its date.
 */
import { addDays, compareDates, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";
import { startOfWeek } from "./plan-list-view.ts";

export interface CalendarItem { id: string; plannedStart: PlainDate; plannedEnd: PlainDate }
export interface CalendarCell<T extends CalendarItem> { date: PlainDate; inMonth: boolean; isToday: boolean; items: T[] }

const covers = (item: CalendarItem, date: PlainDate) => compareDates(item.plannedStart, date) <= 0 && compareDates(item.plannedEnd, date) >= 0;

function cells<T extends CalendarItem>(dates: PlainDate[], today: PlainDate, items: ReadonlyArray<T>, inMonth: (d: PlainDate) => boolean): CalendarCell<T>[] {
  return dates.map((date) => ({ date, inMonth: inMonth(date), isToday: date === today, items: items.filter((i) => covers(i, date)) }));
}

export function weekCells<T extends CalendarItem>(today: PlainDate, items: ReadonlyArray<T>): CalendarCell<T>[] {
  const first = startOfWeek(today);
  return cells(Array.from({ length: 7 }, (_, i) => addDays(first, i)), today, items, () => true);
}

/** Whole weeks (Monday to Sunday) covering the month that contains `today`. */
export function monthCells<T extends CalendarItem>(today: PlainDate, items: ReadonlyArray<T>): CalendarCell<T>[][] {
  const monthStart = `${today.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
  const monthEnd = addDays(next.toISOString().slice(0, 10), -1);
  const first = startOfWeek(monthStart);
  const weeks: CalendarCell<T>[][] = [];
  for (let weekStart = first; compareDates(weekStart, monthEnd) <= 0; weekStart = addDays(weekStart, 7)) {
    weeks.push(cells(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), today, items, (d) => d.slice(0, 7) === today.slice(0, 7)));
  }
  return weeks;
}
