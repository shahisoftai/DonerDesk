/**
 * Drag to reschedule, as arithmetic: pixels become whole days, a mode (move, change start, change end) becomes new dates,
 * and the keyboard does the same through arrow keys. Nothing is saved here; the page opens a confirm bar with the result.
 */
import { addDays, compareDates, formatShortDate, type PlainDate } from "@donordesk/domain/contexts/workplan/index.js";

export type DragMode = "MOVE" | "START" | "END";
export interface Dates { start: PlainDate; end: PlainDate }

/** Whole days for a horizontal drag of `deltaPx` over a track `trackPx` wide that shows `rangeDays` days. */
export function pixelsToDays(deltaPx: number, trackPx: number, rangeDays: number): number {
  if (trackPx <= 0 || rangeDays <= 0) return 0;
  const days = Math.round((deltaPx / trackPx) * rangeDays);
  return Object.is(days, -0) ? 0 : days;
}

export function applyDrag(dates: Dates, mode: DragMode, deltaDays: number): Dates {
  if (mode === "MOVE") return { start: addDays(dates.start, deltaDays), end: addDays(dates.end, deltaDays) };
  if (mode === "START") {
    const start = addDays(dates.start, deltaDays);
    return { start: compareDates(start, dates.end) > 0 ? dates.end : start, end: dates.end };
  }
  const end = addDays(dates.end, deltaDays);
  return { start: dates.start, end: compareDates(end, dates.start) < 0 ? dates.start : end };
}

/** ←/→ move a day; Shift+←/→ change the end. Anything else is not a drag key. */
export function keyboardDrag(key: string, shift: boolean): { mode: DragMode; delta: number } | undefined {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return undefined;
  return { mode: shift ? "END" : "MOVE", delta: key === "ArrowRight" ? 1 : -1 };
}

/** Only an open activity can be dragged; a done or cancelled one has no handles. */
export function isDraggable(status: string, canMove: boolean): boolean {
  return canMove && (status === "PLANNED" || status === "IN_PROGRESS");
}

export function sameDates(a: Dates, b: Dates): boolean {
  return a.start === b.start && a.end === b.end;
}

/** "Move to 12–14 Mar?" for the confirm bar. */
export function confirmQuestion(dates: Dates, today: PlainDate): string {
  if (dates.start === dates.end) return `Move to ${formatShortDate(dates.start, today)}?`;
  const sameMonth = dates.start.slice(0, 7) === dates.end.slice(0, 7);
  const startText = sameMonth ? String(Number(dates.start.slice(8, 10))) : formatShortDate(dates.start, today);
  return `Move to ${startText}–${formatShortDate(dates.end, today)}?`;
}
