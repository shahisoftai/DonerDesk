/**
 * The Timeline view as data: rows grouped by output, a bar per planned activity positioned as percentages of the visible
 * range, a faint outline where the dates moved, a fill for progress, a diamond for a milestone, a line for today and a lane of
 * report deadlines. Pure (no React, no clock): the page passes today in, so every case is a table test.
 */
import { addDays, addMonths, compareDates, daysBetween, formatShortDate, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";

export type TimelineZoom = "MONTH" | "QUARTER" | "PROJECT";
export const TIMELINE_ZOOMS: ReadonlyArray<TimelineZoom> = ["MONTH", "QUARTER", "PROJECT"];
export const TIMELINE_ZOOM_LABEL: Readonly<Record<TimelineZoom, string>> = { MONTH: "Month", QUARTER: "Quarter", PROJECT: "Whole project" };

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
  targetCount?: number;
  deliveredCount: number;
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
  signal: TimelineRow["signal"];
  status: TimelineRow["status"];
  /** Spoken label: "Outreach, 10 to 12 Mar, Late". */
  label: string;
}

export interface TimelineGroup {
  outputId: string | undefined;
  title: string;
  bars: TimelineBar[];
}

export interface TimelineTick { leftPct: number; label: string }
export interface TimelineMark { leftPct: number; label: string; kind: TimelineDeadline["kind"] }

export interface TimelineLayout {
  range: DateRange;
  days: number;
  ticks: TimelineTick[];
  todayPct: number | null;
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
  if (zoom === "MONTH") {
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
    const original = moved ? place(row.originalStart!, row.originalEnd!, range, total) : null;
    const progress = row.status === "DONE" ? 100 : row.targetCount ? Math.min(100, Math.round((row.deliveredCount / row.targetCount) * 100)) : undefined;
    const dates = milestone ? formatShortDate(row.plannedStart, today) : `${formatShortDate(row.plannedStart, today)} to ${formatShortDate(row.plannedEnd, today)}`;
    const bar: TimelineBar = {
      id: row.id, title: row.title, ...spot,
      clippedStart: compareDates(row.plannedStart, range.start) < 0,
      clippedEnd: compareDates(row.plannedEnd, range.end) > 0,
      milestone,
      ...(original ? { original } : {}),
      ...(progress !== undefined ? { progressPct: progress } : {}),
      signal: row.signal, status: row.status,
      label: `${row.title}, ${dates}, ${row.signalLabel}`,
    };
    const group = groups.get(row.outputId) ?? { outputId: row.outputId, title: (row.outputId && input.outputTitles.get(row.outputId)) || OTHER_OUTPUT_TITLE, bars: [] };
    group.bars.push(bar);
    groups.set(row.outputId, group);
  }

  const todayInside = compareDates(today, range.start) >= 0 && compareDates(today, range.end) <= 0;
  return {
    range, days: total,
    ticks: ticksFor(input.zoom, range, total),
    todayPct: todayInside ? pct(daysBetween(range.start, today), total) : null,
    deadlines: input.deadlines
      .filter((d) => compareDates(d.date, range.start) >= 0 && compareDates(d.date, range.end) <= 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ leftPct: pct(daysBetween(range.start, d.date), total), label: `${d.label} ${formatShortDate(d.date, today)}`, kind: d.kind })),
    groups: [...groups.values()].sort((a, b) => (a.outputId === undefined ? 1 : 0) - (b.outputId === undefined ? 1 : 0) || a.title.localeCompare(b.title)),
    hidden,
  };
}
