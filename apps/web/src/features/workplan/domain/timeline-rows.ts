/**
 * The Timeline's rows as one flat list, so the name column on the left and the chart on the right are built from the same list
 * with the same fixed heights and can never drift apart. Also the filters that decide which activities the chart shows. Pure.
 */
import type { TimelineGroup, TimelineLane, TimelineLayout, TimelineRow } from "./timeline-layout";

export const GROUP_ROW_PX = 30;
export const LANE_ROW_PX = 38;

export type TimelineLine =
  | { kind: "GROUP"; key: string; title: string; count: number; donePct: number; lateCount: number; collapsed: boolean; height: number }
  | { kind: "LANE"; key: string; groupKey: string; lane: TimelineLane; height: number };

export const groupKey = (g: Pick<TimelineGroup, "outputId">): string => g.outputId ?? "other";

/** Group headers and lanes in order; a collapsed group keeps its header and drops its lanes. */
export function flattenLayout(layout: Pick<TimelineLayout, "groups">, collapsed: ReadonlySet<string>): TimelineLine[] {
  const lines: TimelineLine[] = [];
  for (const g of layout.groups) {
    const key = groupKey(g);
    const done = g.bars.filter((b) => b.status === "DONE").length;
    const open = g.bars.filter((b) => b.status !== "CANCELLED").length;
    lines.push({
      kind: "GROUP", key, title: g.title, count: g.bars.length,
      donePct: open === 0 ? 0 : Math.round((done / open) * 100),
      lateCount: g.bars.filter((b) => b.signal === "LATE").length,
      collapsed: collapsed.has(key), height: GROUP_ROW_PX,
    });
    if (collapsed.has(key)) continue;
    for (const lane of g.lanes) lines.push({ kind: "LANE", key: lane.key, groupKey: key, lane, height: LANE_ROW_PX });
  }
  return lines;
}

/** Total pixel height of the lines (the chart's body). */
export const linesHeight = (lines: ReadonlyArray<TimelineLine>): number => lines.reduce((sum, l) => sum + l.height, 0);

export interface TimelineFilter {
  /** Matches the title or the lead's name, ignoring case. */
  query: string;
  /** Only activities this person leads or helps with. */
  mineUserId?: string;
  /** Only activities that are late. */
  lateOnly: boolean;
  /** Leave out done and cancelled activities. */
  hideFinished: boolean;
}

export const NO_FILTER: TimelineFilter = { query: "", lateOnly: false, hideFinished: false };

export function isFiltering(f: TimelineFilter): boolean {
  return f.query.trim() !== "" || f.mineUserId !== undefined || f.lateOnly || f.hideFinished;
}

type Filterable = Pick<TimelineRow, "title" | "signal" | "status" | "ownerUserId"> & { supportUserIds?: ReadonlyArray<string> };

export function filterRows<T extends Filterable>(rows: ReadonlyArray<T>, f: TimelineFilter, names: Readonly<Record<string, string>>): T[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.title.toLowerCase().includes(q) && !(r.ownerUserId && (names[r.ownerUserId] ?? "").toLowerCase().includes(q))) return false;
    if (f.mineUserId !== undefined && r.ownerUserId !== f.mineUserId && !(r.supportUserIds ?? []).includes(f.mineUserId)) return false;
    if (f.lateOnly && r.signal !== "LATE") return false;
    if (f.hideFinished && (r.status === "DONE" || r.status === "CANCELLED")) return false;
    return true;
  });
}
