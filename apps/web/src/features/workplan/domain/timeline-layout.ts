/**
 * The Timeline view as data: rows grouped by output, a bar per planned activity positioned as percentages of the visible
 * range, a faint outline where the dates moved, a fill for progress, a diamond for a milestone, a line for today and a lane of
 * report deadlines. Pure (no React, no clock): the page passes today in, so every case is a table test.
 */
import { addDays, addMonths, compareDates, daysBetween, formatShortDate, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";

/**
 * A zoom is a scale, not a window: the chart always spans the whole plan and scrolls sideways. WEEK, MONTH and QUARTER fix the
 * pixels per day; PROJECT fits the whole plan into the visible width.
 */
export type TimelineZoom = "WEEK" | "MONTH" | "QUARTER" | "PROJECT";
export const TIMELINE_ZOOMS: ReadonlyArray<TimelineZoom> = ["WEEK", "MONTH", "QUARTER", "PROJECT"];
export const TIMELINE_ZOOM_LABEL: Readonly<Record<TimelineZoom, string>> = { WEEK: "Week", MONTH: "Month", QUARTER: "Quarter", PROJECT: "Whole project" };
/** Pixels per day for the fixed scales (PROJECT fits the viewport instead). */
export const PIXELS_PER_DAY: Readonly<Record<Exclude<TimelineZoom, "PROJECT">, number>> = { WEEK: 32, MONTH: 14, QUARTER: 5 };
const MIN_FIT_PX_PER_DAY = 2;

export interface TimelineRow {
  id: string;
  title: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  originalStart?: PlainDate;
  originalEnd?: PlainDate;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED";
  signalLabel: string;
  outputId?: string;
  /** "Waiting for …" when it waits for something unfinished (phase 28.1-A), worded by the caller. */
  waitingLabel?: string;
  targetCount?: number;
  deliveredCount: number;
  /** The lead, so a row can say who it is for. */
  ownerUserId?: string;
  /** Repeats of one activity share a series; they are drawn on one line. */
  seriesId?: string;
}

export interface TimelineDeadline {
  date: PlainDate;
  label: string;
  kind: "DEADLINE" | "REVIEW";
}

export interface DateRange {
  start: PlainDate;
  end: PlainDate;
}

export interface TimelineBar {
  id: string;
  title: string;
  leftPct: number;
  widthPct: number;
  /** True when the activity starts before / ends after the visible range. */
  clippedStart: boolean;
  clippedEnd: boolean;
  milestone: boolean;
  /** The original dates, when the activity was moved and they are visible. */
  original?: { leftPct: number; widthPct: number };
  progressPct?: number;
  /** "Waiting for …" when it waits for something unfinished. */
  waiting?: string;
  signal: TimelineRow["signal"];
  status: TimelineRow["status"];
  /** Spoken label: "Outreach, 10 to 12 Mar, Late". */
  label: string;
  /** "10 to 12 Mar" (one day for a milestone), for the row's second line. */
  dates: string;
  signalLabel: string;
  ownerUserId?: string;
  seriesId?: string;
}

/** One line of the chart: a single activity, or every repeat of a series side by side. */
export interface TimelineLane {
  key: string;
  title: string;
  bars: TimelineBar[];
  /** How many repeats the series has in the plan (not only the visible ones); 1 for a single activity. */
  repeats: number;
}

export interface TimelineGroup {
  outputId: string | undefined;
  title: string;
  bars: TimelineBar[];
  lanes: TimelineLane[];
}

/** A month across the top: its place, its name and (for the grid) where it starts. */
export interface TimelineMonth { leftPct: number; widthPct: number; label: string }

export interface TimelineTick { leftPct: number; label: string }
export interface TimelineMark { leftPct: number; label: string; kind: TimelineDeadline["kind"] }

export interface TimelineLayout {
  range: DateRange;
  days: number;
  ticks: TimelineTick[];
  todayPct: number | null;
  months: TimelineMonth[];
  deadlines: TimelineMark[];
  groups: TimelineGroup[];
  /** Activities that are wholly outside the visible range. */
  hidden: number;
}

export const OTHER_OUTPUT_TITLE = "Other activities";

/** The visible window for a zoom level: the month or quarter containing today, or the whole project. */
export function timelineRange(zoom: TimelineZoom, today: PlainDate, project: DateRange): DateRange {
  if (zoom === "PROJECT") return project;
  const monthStart = `${today.slice(0, 7)}-01`;
  if (zoom === "MONTH") return { start: monthStart, end: addDays(addMonths(monthStart, 1), -1) };
  const quarterFirstMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3;
  const start = `${today.slice(0, 4)}-${String(quarterFirstMonth + 1).padStart(2, "0")}-01`;
  return { start, end: addDays(addMonths(start, 3), -1) };
}

/** Everything the plan covers: the project's dates, every activity and every deadline, with a few days of air at each end. */
export function fullRange(input: { project: DateRange; rows: ReadonlyArray<Pick<TimelineRow, "plannedStart" | "plannedEnd">>; deadlines?: ReadonlyArray<TimelineDeadline> }, padDays = 3): DateRange {
  let start = input.project.start;
  let end = input.project.end;
  for (const r of input.rows) {
    if (compareDates(r.plannedStart, start) < 0) start = r.plannedStart;
    if (compareDates(r.plannedEnd, end) > 0) end = r.plannedEnd;
  }
  for (const d of input.deadlines ?? []) {
    if (compareDates(d.date, start) < 0) start = d.date;
    if (compareDates(d.date, end) > 0) end = d.date;
  }
  return { start: addDays(start, -padDays), end: addDays(end, padDays) };
}

/** The chart's width in pixels: a fixed scale, or (PROJECT) the visible width, never narrower than 2 px a day. */
export function chartWidthPx(zoom: TimelineZoom, days: number, viewportPx: number): number {
  if (zoom === "PROJECT") return Math.max(Math.round(days * MIN_FIT_PX_PER_DAY), Math.floor(viewportPx));
  return Math.round(days * PIXELS_PER_DAY[zoom]);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month bands across the range, each clipped to it; the label carries the year in January and on the first band. */
export function monthBands(range: DateRange): TimelineMonth[] {
  const total = inclusiveDays(range);
  const bands: TimelineMonth[] = [];
  let first = true;
  let monthStart = `${range.start.slice(0, 7)}-01`;
  while (compareDates(monthStart, range.end) <= 0) {
    const nextMonth = addMonths(monthStart, 1);
    const from = compareDates(monthStart, range.start) < 0 ? range.start : monthStart;
    const lastDay = addDays(nextMonth, -1);
    const to = compareDates(lastDay, range.end) > 0 ? range.end : lastDay;
    const month = Number(monthStart.slice(5, 7)) - 1;
    const label = first || month === 0 ? `${MONTH_NAMES[month]} ${monthStart.slice(0, 4)}` : MONTH_NAMES[month]!;
    bands.push({ leftPct: pct(daysBetween(range.start, from), total), widthPct: pct(daysBetween(from, to) + 1, total), label });
    first = false;
    monthStart = nextMonth;
  }
  return bands;
}

const inclusiveDays = (r: DateRange) => daysBetween(r.start, r.end) + 1;
const pct = (days: number, total: number) => Math.round((days / total) * 10_000) / 100;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

function place(start: PlainDate, end: PlainDate, range: DateRange, total: number): { leftPct: number; widthPct: number } | null {
  if (compareDates(end, range.start) < 0 || compareDates(start, range.end) > 0) return null;
  const from = compareDates(start, range.start) < 0 ? range.start : start;
  const to = compareDates(end, range.end) > 0 ? range.end : end;
  return { leftPct: clamp(pct(daysBetween(range.start, from), total)), widthPct: pct(daysBetween(from, to) + 1, total) };
}

function ticksFor(zoom: TimelineZoom, range: DateRange, total: number): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  if (zoom === "MONTH" || zoom === "WEEK") {
    // A tick every Monday.
    let d = range.start;
    while (compareDates(d, range.end) <= 0) {
      if (new Date(`${d}T00:00:00Z`).getUTCDay() === 1) ticks.push({ leftPct: pct(daysBetween(range.start, d), total), label: String(Number(d.slice(8, 10))) });
      d = addDays(d, 1);
    }
    return ticks;
  }
  const months = Math.round(total / 30);
  const step = months > 24 ? 3 : 1;
  let d = compareDates(range.start.slice(0, 7) + "-01", range.start) < 0 ? addMonths(`${range.start.slice(0, 7)}-01`, 1) : range.start;
  for (let i = 0; compareDates(d, range.end) <= 0; i += 1) {
    if (i % step === 0) ticks.push({ leftPct: pct(daysBetween(range.start, d), total), label: formatShortDate(d, range.start).replace(/^\d+ /, "") });
    d = addMonths(`${d.slice(0, 7)}-01`, 1);
  }
  return ticks;
}

export function layoutTimeline(input: {
  rows: ReadonlyArray<TimelineRow>;
  deadlines: ReadonlyArray<TimelineDeadline>;
  range: DateRange;
  zoom: TimelineZoom;
  today: PlainDate;
  outputTitles: ReadonlyMap<string, string>;
  /** Planned versus actual (plan §16): the ghost of the original dates. A toggle, on by default for managers. */
  showOriginal?: boolean;
}): TimelineLayout {
  const { range, today } = input;
  const total = inclusiveDays(range);
  const groups = new Map<string | undefined, TimelineGroup>();
  let hidden = 0;

  const sorted = [...input.rows].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.plannedEnd.localeCompare(b.plannedEnd) || a.title.localeCompare(b.title));
  for (const row of sorted) {
    const spot = place(row.plannedStart, row.plannedEnd, range, total);
    if (!spot) { hidden += 1; continue; }
    const milestone = row.plannedStart === row.plannedEnd;
    const moved = row.originalStart && row.originalEnd && (row.originalStart !== row.plannedStart || row.originalEnd !== row.plannedEnd);
    const original = moved && input.showOriginal !== false ? place(row.originalStart!, row.originalEnd!, range, total) : null;
    const progress = row.status === "DONE" ? 100 : row.targetCount ? Math.min(100, Math.round((row.deliveredCount / row.targetCount) * 100)) : undefined;
    const dates = milestone ? formatShortDate(row.plannedStart, today) : `${formatShortDate(row.plannedStart, today)} to ${formatShortDate(row.plannedEnd, today)}`;
    const bar: TimelineBar = {
      id: row.id, title: row.title, ...spot,
      clippedStart: compareDates(row.plannedStart, range.start) < 0,
      clippedEnd: compareDates(row.plannedEnd, range.end) > 0,
      milestone,
      ...(original ? { original } : {}),
      ...(progress !== undefined ? { progressPct: progress } : {}),
      ...(row.waitingLabel ? { waiting: row.waitingLabel } : {}),
      signal: row.signal, status: row.status,
      label: `${row.title}, ${dates}, ${row.signalLabel}`,
      dates, signalLabel: row.signalLabel,
      ...(row.ownerUserId ? { ownerUserId: row.ownerUserId } : {}),
      ...(row.seriesId ? { seriesId: row.seriesId } : {}),
    };
    const group = groups.get(row.outputId) ?? { outputId: row.outputId, title: (row.outputId && input.outputTitles.get(row.outputId)) || OTHER_OUTPUT_TITLE, bars: [], lanes: [] };
    group.bars.push(bar);
    groups.set(row.outputId, group);
  }

  // Repeats of one series share a line; a series is counted over the whole plan, not only what is visible.
  const seriesSize = new Map<string, number>();
  for (const r of input.rows) if (r.seriesId) seriesSize.set(r.seriesId, (seriesSize.get(r.seriesId) ?? 0) + 1);
  for (const g of groups.values()) {
    const bySeries = new Map<string, TimelineBar[]>();
    for (const b of g.bars) if (b.seriesId && (seriesSize.get(b.seriesId) ?? 0) > 1) bySeries.set(b.seriesId, [...(bySeries.get(b.seriesId) ?? []), b]);
    const seen = new Set<string>();
    for (const b of g.bars) {
      if (b.seriesId && bySeries.has(b.seriesId)) {
        if (seen.has(b.seriesId)) continue;
        seen.add(b.seriesId);
        g.lanes.push({ key: `series:${b.seriesId}`, title: b.title, bars: bySeries.get(b.seriesId)!, repeats: seriesSize.get(b.seriesId)! });
      } else {
        g.lanes.push({ key: b.id, title: b.title, bars: [b], repeats: 1 });
      }
    }
  }

  const todayInside = compareDates(today, range.start) >= 0 && compareDates(today, range.end) <= 0;
  return {
    range, days: total,
    ticks: ticksFor(input.zoom, range, total),
    todayPct: todayInside ? pct(daysBetween(range.start, today), total) : null,
    months: monthBands(range),
    deadlines: input.deadlines
      .filter((d) => compareDates(d.date, range.start) >= 0 && compareDates(d.date, range.end) <= 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ leftPct: pct(daysBetween(range.start, d.date), total), label: `${d.label} ${formatShortDate(d.date, today)}`, kind: d.kind })),
    groups: [...groups.values()].sort((a, b) => (a.outputId === undefined ? 1 : 0) - (b.outputId === undefined ? 1 : 0) || a.title.localeCompare(b.title)),
    hidden,
  };
}
