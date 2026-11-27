/** The date ranges the website-visitors report offers. A new range is a new row, never a branch. */
export const STATS_RANGES = [7, 28, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const DEFAULT_STATS_RANGE: StatsRange = 28;

/** An unknown or missing value is the default range, never an error: the page must always open. */
export function parseStatsRange(raw: unknown): StatsRange {
  const days = typeof raw === "string" ? Number(raw) : raw;
  return (STATS_RANGES as readonly unknown[]).includes(days) ? (days as StatsRange) : DEFAULT_STATS_RANGE;
}

/** A plain calendar window, `YYYY-MM-DD` both ends inclusive. */
export interface DateWindow {
  startDate: string;
  endDate: string;
}

const DAY_MS = 86_400_000;

function plainDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * The window of `days` days ending `lagDays` before today, and the equally long window just before it.
 * Search Console data runs about two days behind, so its caller passes a lag; Analytics passes none.
 */
export function windowsFor(days: StatsRange, today: Date, lagDays = 0): { current: DateWindow; previous: DateWindow } {
  const end = startOfUtcDay(today) - lagDays * DAY_MS;
  const start = end - (days - 1) * DAY_MS;
  return {
    current: { startDate: plainDay(start), endDate: plainDay(end) },
    previous: { startDate: plainDay(start - days * DAY_MS), endDate: plainDay(start - DAY_MS) },
  };
}

/** Every day of a window, in order, as `YYYY-MM-DD` (so a chart can show a day with no visits as a real zero). */
export function daysIn(window: DateWindow): string[] {
  const out: string[] = [];
  const end = Date.parse(`${window.endDate}T00:00:00Z`);
  for (let t = Date.parse(`${window.startDate}T00:00:00Z`); t <= end; t += DAY_MS) out.push(plainDay(t));
  return out;
}
