/**
 * A target schedule: the cumulative target an indicator should have reached by given dates, so a monthly or quarterly value is judged
 * against what was due by then rather than against the project's final target. Pure; no clock.
 *
 * The schedule is a list of `{ asOf, target }`. The target that applies to a period is the entry with the latest `asOf` that is not
 * after the period's end; before the first entry (or with no schedule) the project's own target applies.
 */
export interface TargetScheduleEntry {
  /** Plain day, `YYYY-MM-DD`: the date by which this cumulative target should be reached. */
  asOf: string;
  /** The cumulative target by that date, as typed. */
  target: string;
}

export type TargetSchedule = ReadonlyArray<TargetScheduleEntry>;

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toNumber = (text: string | undefined): number | null => {
  if (text === undefined || text.trim() === "") return null;
  const n = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const isRealDate = (text: string): boolean => {
  if (!PLAIN_DATE.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
};

export interface TargetScheduleProblem {
  /** 1-based position of the entry. */
  row: number;
  message: string;
}

/** Problems that make a schedule unusable: a bad date, a non-numeric target, a repeated date. Nothing is dropped silently. */
export function targetScheduleProblems(schedule: TargetSchedule): TargetScheduleProblem[] {
  const problems: TargetScheduleProblem[] = [];
  const seen = new Set<string>();
  schedule.forEach((entry, i) => {
    const row = i + 1;
    if (!isRealDate(entry.asOf)) problems.push({ row, message: "The date must be a real day written as YYYY-MM-DD." });
    else if (seen.has(entry.asOf)) problems.push({ row, message: "This date is already in the schedule." });
    else seen.add(entry.asOf);
    if (toNumber(entry.target) === null) problems.push({ row, message: "The target must be a number." });
  });
  return problems;
}

/** Entries in date order, for display and lookup. Invalid entries are left for `targetScheduleProblems` to report. */
export function sortedTargetSchedule(schedule: TargetSchedule): TargetScheduleEntry[] {
  return [...schedule].sort((a, b) => a.asOf.localeCompare(b.asOf));
}

/** Reads the stored JSON. Unreadable or missing text is an empty schedule: a project without one behaves exactly as before. */
export function parseTargetSchedule(json: string | null | undefined): TargetScheduleEntry[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e): e is { asOf: unknown; target: unknown } => typeof e === "object" && e !== null)
      .map((e) => ({ asOf: String(e.asOf ?? ""), target: String(e.target ?? "") }));
  } catch {
    return [];
  }
}

/** Reads lines such as `2026-03-31: 250` or `2026-03-31, 250` (one per line). A line that cannot be read is returned as a problem. */
export function parseTargetScheduleText(text: string): { schedule: TargetScheduleEntry[]; problems: TargetScheduleProblem[] } {
  const schedule: TargetScheduleEntry[] = [];
  const problems: TargetScheduleProblem[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === "") return;
    const match = /^\s*(\d{4}-\d{2}-\d{2})\s*[:,;\t]\s*(.+?)\s*$/.exec(line);
    if (!match) problems.push({ row: i + 1, message: "Write each line as a date, a colon and the target, for example 2026-03-31: 250." });
    else schedule.push({ asOf: match[1]!, target: match[2]! });
  });
  return { schedule, problems: [...problems, ...targetScheduleProblems(schedule)] };
}

export function formatTargetScheduleText(schedule: TargetSchedule): string {
  return sortedTargetSchedule(schedule).map((e) => `${e.asOf}: ${e.target}`).join("\n");
}

export interface PeriodTarget {
  /** The target a value for this period is judged against. */
  target: string;
  /** "SCHEDULE" when it came from the schedule, "PROJECT" when the project's own target applies. */
  source: "SCHEDULE" | "PROJECT";
  /** The schedule date it came from, when it did. */
  asOf?: string;
}

/** The target for a period ending on `periodEnd` (a plain day). */
export function targetForPeriod(schedule: TargetSchedule, projectTarget: string, periodEnd: string): PeriodTarget {
  const applicable = sortedTargetSchedule(schedule.filter((e) => isRealDate(e.asOf) && toNumber(e.target) !== null))
    .filter((e) => e.asOf <= periodEnd)
    .pop();
  return applicable ? { target: applicable.target, source: "SCHEDULE", asOf: applicable.asOf } : { target: projectTarget, source: "PROJECT" };
}

export interface Variance {
  /** `value - target`, rounded to 2 decimals. Positive means above the target. */
  absolute: number;
  /** Share of the target, `absolute / target`, rounded to a whole percent; null when the target is zero. */
  percent: number | null;
}

/** How far a value is from its target. Null when either figure is missing: a missing value is never read as 0. */
export function varianceAgainst(value: string | undefined, target: string | undefined): Variance | null {
  const v = toNumber(value);
  const t = toNumber(target);
  if (v === null || t === null) return null;
  return { absolute: Math.round((v - t) * 100) / 100, percent: t === 0 ? null : Math.round(((v - t) / t) * 100) };
}

/** "+12 (+8%)" or "-5 (-20%)"; the percent is left out when there is none. */
export function describeVariance(variance: Variance): string {
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "");
  const abs = `${sign(variance.absolute)}${Math.abs(variance.absolute)}`;
  return variance.percent === null ? abs : `${abs} (${sign(variance.percent)}${Math.abs(variance.percent)}%)`;
}
