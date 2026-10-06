/**
 * One formatter for the choices a user picks from, so no two options look alike: a period reads
 * "Monthly · Mar 2026" (not "MONTHLY"), an activity "6 Mar 2026 · Title (Place)". Dates are read in UTC because
 * they are stored as calendar dates.
 */

export interface PeriodLike {
  id: string;
  reportType: string;
  startDate: string;
  endDate: string;
}

export interface ActivityLike {
  activityTitle: string;
  activityDate: string;
  location?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utc(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

function typeWords(reportType: string): string {
  const words = reportType.toLowerCase().replace(/_/g, "-");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function periodOptionLabel(period: Pick<PeriodLike, "reportType" | "startDate" | "endDate">): string {
  const start = utc(period.startDate);
  const end = utc(period.endDate);
  const type = typeWords(period.reportType);
  if (!start || !end) return type;
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  return `${type} · ${sameMonth ? monthYear(end) : `${monthYear(start)} – ${monthYear(end)}`}`;
}

export function activityOptionLabel(activity: ActivityLike): string {
  const date = utc(activity.activityDate);
  const when = date ? `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : "";
  const where = activity.location ? ` (${activity.location})` : "";
  return `${when ? `${when} · ` : ""}${activity.activityTitle}${where}`;
}

/** Most recent first (by the given ISO date), so the choice a user usually wants is at the top. */
export function recentFirst<T>(items: ReadonlyArray<T>, dateOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
}

/** The id of the period whose dates contain `date` (inclusive); the narrowest one wins when periods overlap. */
export function periodContainingDate(periods: ReadonlyArray<PeriodLike>, date: string): string | undefined {
  const day = utc(date)?.getTime();
  if (day === undefined) return undefined;
  const inside = periods
    .map((p) => ({ id: p.id, start: utc(p.startDate)?.getTime(), end: utc(p.endDate)?.getTime() }))
    .filter((p): p is { id: string; start: number; end: number } => p.start !== undefined && p.end !== undefined && p.start <= day && day <= p.end + 24 * 60 * 60 * 1000 - 1);
  inside.sort((a, b) => a.end - a.start - (b.end - b.start));
  return inside[0]?.id;
}
