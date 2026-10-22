/**
 * Plain words and choices for "Comes after" (phase 28.1-A). Pure: the server decides what is allowed (loops, duplicates,
 * other projects); this only decides what the person is offered and how a wait reads.
 */
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";

export interface DependencyOption {
  id: string;
  title: string;
  /** What the picker shows: the title and its dates, because a monthly series has one title for every month. */
  label: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Dec 2026" from a plain day; anything else is returned as it came. */
function shortDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : day;
}

/** "Monthly outreach clinics (1 Dec 2026 to 7 Dec 2026)": the title with the days it is planned for. */
export function dependencyLabel(title: string, plannedStart: string, plannedEnd?: string): string {
  const start = shortDay(plannedStart);
  const end = plannedEnd && plannedEnd !== plannedStart ? shortDay(plannedEnd) : undefined;
  return `${title} (${end ? `${start} to ${end}` : start})`;
}

/** "Waiting for Survey and Training", or undefined when nothing it waits for is unfinished. */
export function waitingLine(waitingFor: ReadonlyArray<{ title: string }>): string | undefined {
  if (waitingFor.length === 0) return undefined;
  const titles = waitingFor.map((w) => w.title);
  const names = titles.length === 1 ? titles[0]! : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${WORKPLAN_COPY.waitingFor} ${names}`;
}

/**
 * Activities a person may pick as "comes after": every other live activity in the project, except those already linked
 * and those that already wait for this one (picking them would close a loop at once). Sorted by start, then title.
 */
export function dependencyOptions(
  itemId: string,
  rows: ReadonlyArray<{ id: string; title: string; status: string; plannedStart: string; plannedEnd?: string; comesAfter: ReadonlyArray<{ id: string }>; comesBefore: ReadonlyArray<{ id: string }> }>,
): DependencyOption[] {
  const linked = new Set(rows.find((r) => r.id === itemId)?.comesAfter.map((a) => a.id) ?? []);
  const successors = new Set(rows.find((r) => r.id === itemId)?.comesBefore.map((b) => b.id) ?? []);
  return rows
    .filter((r) => r.id !== itemId && r.status !== "CANCELLED" && !linked.has(r.id) && !successors.has(r.id))
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title))
    .map((r) => ({ id: r.id, title: r.title, label: dependencyLabel(r.title, r.plannedStart, r.plannedEnd) }));
}

export interface BoxPx { x: number; y: number; width: number; height: number }

/** A link to draw: an arrow from the activity that comes first to the one that comes after. Only when both are on the timeline. */
export function dependencyLinks(
  rows: ReadonlyArray<{ id: string; comesAfter: ReadonlyArray<{ id: string; finished: boolean }> }>,
  visibleIds: ReadonlySet<string>,
): Array<{ fromId: string; toId: string; finished: boolean }> {
  const out: Array<{ fromId: string; toId: string; finished: boolean }> = [];
  for (const row of rows) {
    if (!visibleIds.has(row.id)) continue;
    for (const before of row.comesAfter) if (visibleIds.has(before.id)) out.push({ fromId: before.id, toId: row.id, finished: before.finished });
  }
  return out;
}

/**
 * An elbow from the right edge of the first bar to the left edge of the next: out a little, down or up to the next bar's middle,
 * then in. Coordinates are pixels inside the timeline. When the next bar starts before the first ends (a conflict) the line
 * still runs, leaving by the end of the first bar and entering at the start of the next.
 */
export function elbowPath(from: BoxPx, to: BoxPx, gap = 8): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const outX = x1 + gap;
  const inX = Math.max(outX, x2 - gap);
  const r = (n: number) => Math.round(n * 10) / 10;
  if (x2 >= outX + gap) return `M ${r(x1)} ${r(y1)} H ${r(inX)} V ${r(y2)} H ${r(x2)}`;
  // The next bar starts too early to fit an elbow beside it: go out, down between the rows, then back in from the left.
  const midY = y2 > y1 ? to.y - 2 : to.y + to.height + 2;
  return `M ${r(x1)} ${r(y1)} H ${r(outX)} V ${r(midY)} H ${r(x2 - gap)} V ${r(y2)} H ${r(x2)}`;
}
