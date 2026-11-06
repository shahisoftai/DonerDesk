import { addDays, type PlainDate } from "../workplan/plain-date.js";

/** Monday of the week that contains `date` (weeks run Monday to Sunday). */
export function startOfWeekMonday(date: PlainDate): PlainDate {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}
