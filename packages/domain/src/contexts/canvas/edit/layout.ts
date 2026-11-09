/**
 * Where blocks sit once one is placed, moved or resized (Phase 45.3): the dashboards' rule (a dropped block keeps its place, every other
 * block falls to the highest free row, nothing overlaps) but with the canvas's own limits. A block's size is bounded by its own
 * definition, not by the dashboard grid's minimum of two cells, so a one-row divider or banner stays one row.
 */
import { CANVAS_GRID_COLUMNS } from "../canvas.js";

export interface LayoutBox { id: string; x: number; y: number; w: number; h: number }
const MAX_ROWS = 400;

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);
const overlaps = (a: LayoutBox, b: LayoutBox): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** `pinned` is the block (or blocks) that keep their place; everything else falls around them. */
export function settleBoxes<T extends LayoutBox>(boxes: ReadonlyArray<T>, pinned?: string | readonly string[]): T[] {
  const fit = (b: T): T => {
    const w = clamp(Math.round(b.w), 1, CANVAS_GRID_COLUMNS);
    return { ...b, w, h: clamp(Math.round(b.h), 1, 60), x: clamp(Math.round(b.x), 0, CANVAS_GRID_COLUMNS - w), y: clamp(Math.round(b.y), 0, MAX_ROWS) };
  };
  const all = boxes.map(fit);
  const pins = new Set(pinned === undefined ? [] : typeof pinned === "string" ? [pinned] : pinned);
  const fixed = all.filter((b) => pins.has(b.id));
  const rest = all.filter((b) => !pins.has(b.id)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const placed: T[] = [...fixed];
  for (const b of rest) {
    let y = b.y;
    for (;;) {
      const candidate = { ...b, y };
      const hit = placed.find((p) => overlaps(candidate, p));
      if (!hit) { placed.push(candidate); break; }
      y = hit.y + hit.h;
    }
  }
  // Back in the order they were given, so a caller's list does not reshuffle.
  return boxes.map((b) => placed.find((p) => p.id === b.id)!);
}
