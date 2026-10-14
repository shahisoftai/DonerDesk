/**
 * Which reporting period a calendar date falls in. One rule for the activity form, the activity import and
 * anything else that must "derive, not ask" the period: the period whose dates contain the date (end day
 * included); when periods overlap the narrowest one wins, then the one that started last.
 */

export interface DatedPeriod {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function time(value: string | Date): number | undefined {
  const t = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(t) ? undefined : t;
}

export function periodForDate(periods: ReadonlyArray<DatedPeriod>, date: string | Date): string | undefined {
  const day = time(date);
  if (day === undefined) return undefined;
  const inside: Array<{ id: string; start: number; end: number }> = [];
  for (const p of periods) {
    const start = time(p.startDate);
    const end = time(p.endDate);
    if (start === undefined || end === undefined) continue;
    if (start <= day && day <= end + DAY_MS - 1) inside.push({ id: p.id, start, end });
  }
  inside.sort((a, b) => a.end - a.start - (b.end - b.start) || b.start - a.start);
  return inside[0]?.id;
}
