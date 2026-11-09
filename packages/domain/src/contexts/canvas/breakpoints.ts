/**
 * Responsive layout (Phase 48.4). Three breakpoints; a block has a desktop place and may carry its own tablet and phone place. Without
 * an override a block reflows in reading order: two across on a tablet where they fit, one per row on a phone. A block that is empty
 * on screen collapses (its row closes); print and files never collapse (they say "Not yet reported"). Pure.
 */
import type { BlockInstance, CanvasBounds } from "./canvas.js";

export const BREAKPOINTS = ["DESKTOP", "TABLET", "PHONE"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];
export const BREAKPOINT_MIN_WIDTH: Readonly<Record<Breakpoint, number>> = { DESKTOP: 1024, TABLET: 640, PHONE: 0 };
export const COLUMNS_AT: Readonly<Record<Breakpoint, number>> = { DESKTOP: 12, TABLET: 6, PHONE: 1 };

export const breakpointFor = (widthPx: number): Breakpoint => (widthPx >= BREAKPOINT_MIN_WIDTH.DESKTOP ? "DESKTOP" : widthPx >= BREAKPOINT_MIN_WIDTH.TABLET ? "TABLET" : "PHONE");

const reading = (a: BlockInstance, b: BlockInstance): number => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x || a.id.localeCompare(b.id);

export interface Placed { id: string; bounds: CanvasBounds }

/**
 * Where every top-level block sits at a breakpoint: its own override if it has one, otherwise a reflow. `isEmpty` marks blocks that
 * have nothing to show on screen; they are left out so their row closes.
 */
export function layoutAt(blocks: ReadonlyArray<BlockInstance>, bp: Breakpoint, isEmpty: (b: BlockInstance) => boolean = () => false): Placed[] {
  const top = blocks.filter((b) => !b.container && b.style?.hidden !== true && !isEmpty(b)).sort(reading);
  if (bp === "DESKTOP") return top.map((b) => ({ id: b.id, bounds: b.bounds }));
  const cols = COLUMNS_AT[bp];
  const out: Placed[] = [];
  let x = 0, y = 0, rowH = 0;
  for (const b of top) {
    const own = bp === "TABLET" ? b.tablet : b.phone;
    if (own) { out.push({ id: b.id, bounds: own }); y = Math.max(y, own.y + own.h); x = 0; rowH = 0; continue; }
    // Half the desktop width (at least 3 of 12) shares a tablet row; anything wider or any phone block takes the whole row.
    const w = bp === "PHONE" ? 1 : Math.min(cols, b.bounds.w <= 6 ? Math.max(3, Math.round(b.bounds.w / 2)) : cols);
    if (x + w > cols) { y += rowH; x = 0; rowH = 0; }
    out.push({ id: b.id, bounds: { x, y, w, h: b.bounds.h } });
    x += w; rowH = Math.max(rowH, b.bounds.h);
    if (x >= cols) { y += rowH; x = 0; rowH = 0; }
  }
  return out;
}

/** Gives a block its own tablet or phone place, or removes it (`undefined`). */
export function setBreakpointBounds(b: BlockInstance, bp: Exclude<Breakpoint, "DESKTOP">, bounds: CanvasBounds | undefined): BlockInstance {
  return bp === "TABLET" ? { ...b, tablet: bounds } : { ...b, phone: bounds };
}

export function breakpointProblems(b: BlockInstance): string[] {
  const out: string[] = [];
  for (const [name, bp, cols] of [["tablet", b.tablet, COLUMNS_AT.TABLET], ["phone", b.phone, COLUMNS_AT.PHONE]] as const) {
    if (!bp) continue;
    if (![bp.x, bp.y, bp.w, bp.h].every(Number.isInteger) || bp.x < 0 || bp.y < 0 || bp.w < 1 || bp.h < 1 || bp.x + bp.w > cols) out.push(`The ${name} place is outside the ${cols}-column layout.`);
  }
  return out;
}

/** Stacks child sizes in a row or column with a gap and padding (auto-layout). Wrapping starts a new line when the next child would pass `limit`. */
export function layoutStack(children: ReadonlyArray<{ id: string; w: number; h: number }>, o: { direction: "ROW" | "COLUMN"; gap: number; padding: number; wrap?: boolean; limit?: number }): { items: Array<{ id: string; x: number; y: number }>; size: { w: number; h: number } } {
  const items: Array<{ id: string; x: number; y: number }> = [];
  let x = o.padding, y = o.padding, lineMax = 0, maxX = 0, maxY = 0;
  for (const c of children) {
    if (o.direction === "ROW") {
      if (o.wrap && o.limit !== undefined && x + c.w > o.limit - o.padding && x > o.padding) { x = o.padding; y += lineMax + o.gap; lineMax = 0; }
      items.push({ id: c.id, x, y }); x += c.w + o.gap; lineMax = Math.max(lineMax, c.h); maxX = Math.max(maxX, x - o.gap); maxY = Math.max(maxY, y + c.h);
    } else {
      items.push({ id: c.id, x, y }); y += c.h + o.gap; maxX = Math.max(maxX, x + c.w); maxY = Math.max(maxY, y - o.gap);
    }
  }
  return { items, size: { w: maxX + o.padding, h: maxY + o.padding } };
}
