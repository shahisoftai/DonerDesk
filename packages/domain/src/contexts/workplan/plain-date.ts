/**
 * Plan dates are plain calendar days ("2026-03-12"), never instants: a due date means the same day in every time
 * zone. All day arithmetic for the work plan goes through this module.
 */
export type PlainDate = string;

const PLAIN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== "string") return false;
  const m = PLAIN.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** The calendar day of a Date (UTC) or of an ISO string; undefined when it is not a date. */
export function toPlainDate(value: Date | string): PlainDate | undefined {
  if (typeof value === "string" && isPlainDate(value.slice(0, 10)) && (value.length === 10 || value[10] === "T")) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function utc(date: PlainDate): number {
  const m = PLAIN.exec(date);
  if (!m) throw new Error(`Not a plain date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtc(t: number): PlainDate {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromUtc(utc(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: PlainDate, b: PlainDate): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function compareDates(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `months` after `date`, on `anchorDay` (default: the date's own day), clamped to the month's last day. */
export function addMonths(date: PlainDate, months: number, anchorDay?: number): PlainDate {
  const d = new Date(utc(date));
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(anchorDay ?? d.getUTCDate(), daysInMonth(year, month));
  return fromUtc(Date.UTC(year, month, day));
}

/** "3 Mar" (the year is added when it differs from `relativeTo`'s). */
export function formatShortDate(date: PlainDate, relativeTo?: PlainDate): string {
  const d = new Date(utc(date));
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return relativeTo && relativeTo.slice(0, 4) !== date.slice(0, 4) ? `${base} ${d.getUTCFullYear()}` : base;
}
