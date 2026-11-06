/**
 * The day chips on every Record form: Today, Yesterday, Pick a day. Plain `YYYY-MM-DD` days, never a local-time `Date` (a phone's zone
 * must not move a day). Today is passed in; nothing here reads the clock.
 */
export type DayChoice = "today" | "yesterday" | "pick";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isPlainDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const t = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === value;
}

/** The day before `day`. A bad day is returned unchanged so the form shows its own "not a real date" note. */
export function dayBefore(day: string): string {
  if (!isPlainDay(day)) return day;
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** The date a chip stands for. "Pick a day" keeps whatever was typed in the date box. */
export function dateForChoice(choice: DayChoice, today: string, picked: string): string {
  if (choice === "today") return today;
  if (choice === "yesterday") return dayBefore(today);
  return picked;
}

/** The chip a date matches, so a saved or deep-linked date highlights the right one. */
export function choiceForDate(date: string, today: string): DayChoice {
  if (date === today) return "today";
  if (date === dayBefore(today)) return "yesterday";
  return "pick";
}

/** Today as a plain day in the PERSON's own zone (what their phone's calendar says). A project's own zone refines this later. */
export function localPlainDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
