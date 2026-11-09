/**
 * Gestures on several blocks at once (Phase 48.1): move, nudge, align, distribute, match size, reorder, duplicate, remove, lock,
 * hide and group. Pure functions from a canvas, a page's selected ids and an input to a new canvas or a reason, like `edit.ts`.
 * One call is one undo step. Locked blocks are never changed by a multi-block gesture: they are listed in `skipped` so the screen
 * can say so, and a gesture that would change nothing at all is refused with a reason rather than silently doing nothing.
 */
import { CANVAS_GRID_COLUMNS, CANVAS_MAX_BLOCKS_PER_PAGE, type BlockInstance, type Canvas, type CanvasBounds, type CanvasPage } from "../canvas.js";
import { definitionFor } from "../blocks/registry.js";
import { settleBlocks } from "./edit.js";
import { boundsOf, pageOf } from "./selection.js";

export type ArrangeResult = { ok: true; canvas: Canvas; skipped: string[] } | { ok: false; reason: string };
const fail = (reason: string): ArrangeResult => ({ ok: false, reason });

interface Scope { page: CanvasPage; movable: BlockInstance[]; skipped: string[] }

/** The selected blocks that may change, on one page. */
function scopeOf(c: Canvas, ids: readonly string[], minimum = 1): Scope | string {
  if (ids.length === 0) return "Select a block first.";
  const page = pageOf(c, ids[0]!);
  if (!page) return "That block does not exist.";
  const chosen = ids.map((i) => page.blocks.find((b) => b.id === i));
  if (chosen.some((b) => !b)) return "Select blocks on one page.";
  const blocks = chosen as BlockInstance[];
  const movable = blocks.filter((b) => !b.style?.locked);
  const skipped = blocks.filter((b) => b.style?.locked).map((b) => b.id);
  if (movable.length < minimum) return skipped.length > 0 && blocks.length >= minimum ? "The selected blocks are locked." : `Select at least ${minimum} blocks.`;
  return { page, movable, skipped };
}

const replacePage = (c: Canvas, page: CanvasPage, blocks: BlockInstance[]): Canvas => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...page, blocks } : p)) });

/** Applies new bounds to some blocks, keeps those blocks where they are put and lets the rest fall around them. */
function withBounds(c: Canvas, scope: Scope, bounds: ReadonlyMap<string, CanvasBounds>): ArrangeResult {
  const changed = scope.movable.filter((b) => { const n = bounds.get(b.id); return n && (n.x !== b.bounds.x || n.y !== b.bounds.y || n.w !== b.bounds.w || n.h !== b.bounds.h); });
  if (changed.length === 0) return fail("Nothing would change.");
  const next = scope.page.blocks.map((b) => (bounds.has(b.id) && changed.some((m) => m.id === b.id) ? { ...b, bounds: bounds.get(b.id)! } : b));
  return { ok: true, canvas: replacePage(c, scope.page, settleBlocks(next, changed.map((b) => b.id))), skipped: scope.skipped };
}

const within = (b: CanvasBounds): boolean => b.x >= 0 && b.y >= 0 && b.x + b.w <= CANVAS_GRID_COLUMNS;

export function moveMany(c: Canvas, ids: readonly string[], dx: number, dy: number): ArrangeResult {
  const scope = scopeOf(c, ids);
  if (typeof scope === "string") return fail(scope);
  const next = new Map(scope.movable.map((b) => [b.id, { ...b.bounds, x: b.bounds.x + dx, y: b.bounds.y + dy }]));
  // The group moves as a whole: if any block would leave the page, none moves.
  if ([...next.values()].some((b) => !within(b))) return fail("A block cannot leave the page.");
  return withBounds(c, scope, next);
}

/** Arrow keys move by one cell, Shift by ten rows or three columns. */
export const nudge = (c: Canvas, ids: readonly string[], direction: "LEFT" | "RIGHT" | "UP" | "DOWN", big = false): ArrangeResult =>
  moveMany(c, ids, direction === "LEFT" ? (big ? -3 : -1) : direction === "RIGHT" ? (big ? 3 : 1) : 0, direction === "UP" ? (big ? -10 : -1) : direction === "DOWN" ? (big ? 10 : 1) : 0);

export const ALIGNMENTS = ["LEFT", "CENTER", "RIGHT", "TOP", "MIDDLE", "BOTTOM"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** Aligns to the edges of the selection as a whole (two or more blocks). */
export function align(c: Canvas, ids: readonly string[], how: Alignment): ArrangeResult {
  const scope = scopeOf(c, ids, 2);
  if (typeof scope === "string") return fail(scope);
  const box = boundsOf(scope.movable)!;
  const next = new Map(scope.movable.map((b) => {
    const { x, y, w, h } = b.bounds;
    const moved: CanvasBounds =
      how === "LEFT" ? { x: box.x, y, w, h } : how === "RIGHT" ? { x: box.x + box.w - w, y, w, h } : how === "CENTER" ? { x: Math.round(box.x + (box.w - w) / 2), y, w, h }
      : how === "TOP" ? { x, y: box.y, w, h } : how === "BOTTOM" ? { x, y: box.y + box.h - h, w, h } : { x, y: Math.round(box.y + (box.h - h) / 2), w, h };
    return [b.id, moved];
  }));
  return withBounds(c, scope, next);
}

/** Even gaps between three or more blocks; the outer two stay where they are. Whole cells only, so a gap may differ by one cell. */
export function distribute(c: Canvas, ids: readonly string[], axis: "HORIZONTAL" | "VERTICAL"): ArrangeResult {
  const scope = scopeOf(c, ids, 3);
  if (typeof scope === "string") return fail(scope);
  const horizontal = axis === "HORIZONTAL";
  const sorted = [...scope.movable].sort((a, b) => (horizontal ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y));
  const size = (b: BlockInstance) => (horizontal ? b.bounds.w : b.bounds.h);
  const start = horizontal ? sorted[0]!.bounds.x : sorted[0]!.bounds.y;
  const last = sorted.at(-1)!;
  const end = (horizontal ? last.bounds.x : last.bounds.y) + size(last);
  const free = end - start - sorted.reduce((sum, b) => sum + size(b), 0);
  if (free < 0) return fail("The blocks overlap too much to space out.");
  const gap = free / (sorted.length - 1);
  let cursor = start;
  const next = new Map<string, CanvasBounds>();
  sorted.forEach((b, i) => {
    const pos = i === sorted.length - 1 ? (horizontal ? last.bounds.x : last.bounds.y) : Math.round(cursor);
    next.set(b.id, horizontal ? { ...b.bounds, x: pos } : { ...b.bounds, y: pos });
    cursor += size(b) + gap;
  });
  return withBounds(c, scope, next);
}

/** Makes the selected blocks the size of the reference block, within each block's own limits. */
export function matchSize(c: Canvas, ids: readonly string[], referenceId: string, what: "WIDTH" | "HEIGHT" | "BOTH"): ArrangeResult {
  const scope = scopeOf(c, ids, 2);
  if (typeof scope === "string") return fail(scope);
  const ref = scope.page.blocks.find((b) => b.id === referenceId);
  if (!ref) return fail("Choose one of the selected blocks to match.");
  const next = new Map<string, CanvasBounds>();
  for (const b of scope.movable) {
    if (b.id === referenceId) continue;
    const s = definitionFor(b.kind)?.sizes;
    if (!s) continue;
    const w = what === "HEIGHT" ? b.bounds.w : Math.min(s.max.w, Math.max(s.min.w, ref.bounds.w));
    const h = what === "WIDTH" ? b.bounds.h : Math.min(s.max.h, Math.max(s.min.h, ref.bounds.h));
    next.set(b.id, { ...b.bounds, w, h: h, x: Math.min(b.bounds.x, CANVAS_GRID_COLUMNS - w) });
  }
  return withBounds(c, scope, next);
}

export const ORDER_MOVES = ["FRONT", "BACK", "FORWARD", "BACKWARD"] as const;
export type OrderMove = (typeof ORDER_MOVES)[number];

/** Moves blocks within the page's order. On a grid page this is the reading order (what a screen reader and a phone follow); on a free page it is the stacking order. */
export function reorder(c: Canvas, ids: readonly string[], move: OrderMove): ArrangeResult {
  const scope = scopeOf(c, ids);
  if (typeof scope === "string") return fail(scope);
  const chosen = new Set(scope.movable.map((b) => b.id));
  const blocks = [...scope.page.blocks];
  const picked = blocks.filter((b) => chosen.has(b.id));
  const others = blocks.filter((b) => !chosen.has(b.id));
  let result: BlockInstance[];
  if (move === "FRONT") result = [...others, ...picked];
  else if (move === "BACK") result = [...picked, ...others];
  else {
    result = [...blocks];
    const order = move === "FORWARD" ? [...result.keys()].reverse() : [...result.keys()];
    for (const i of order) {
      const j = move === "FORWARD" ? i + 1 : i - 1;
      if (chosen.has(result[i]!.id) && j >= 0 && j < result.length && !chosen.has(result[j]!.id)) [result[i], result[j]] = [result[j]!, result[i]!];
    }
  }
  if (result.every((b, i) => b.id === blocks[i]!.id)) return fail("Nothing would change.");
  return { ok: true, canvas: replacePage(c, scope.page, result), skipped: scope.skipped };
}

export function removeMany(c: Canvas, ids: readonly string[]): ArrangeResult {
  const scope = scopeOf(c, ids);
  if (typeof scope === "string") return fail(scope);
  const gone = new Set(scope.movable.map((b) => b.id));
  const rest = scope.page.blocks.filter((b) => !gone.has(b.id)).map((b) => (b.container && gone.has(b.container.id) ? { ...b, container: undefined } : b));
  return { ok: true, canvas: replacePage(c, scope.page, settleBlocks(rest)), skipped: scope.skipped };
}

/** Copies go below the originals, unlocked, with ids made by the caller (one per selected block, in the same order). */
export function duplicateMany(c: Canvas, ids: readonly string[], newIds: readonly string[]): ArrangeResult {
  const scope = scopeOf(c, ids);
  if (typeof scope === "string") return fail(scope);
  if (newIds.length < scope.movable.length) return fail("Each copy needs its own id.");
  if (scope.page.blocks.length + scope.movable.length > CANVAS_MAX_BLOCKS_PER_PAGE) return fail(`A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.`);
  if (c.pages.some((p) => p.blocks.some((b) => newIds.includes(b.id)))) return fail("Two blocks share an id.");
  const box = boundsOf(scope.movable)!;
  const idMap = new Map(scope.movable.map((b, i) => [b.id, newIds[i]!]));
  const copies = scope.movable.map((b) => ({ ...structuredClone(b), id: idMap.get(b.id)!, bounds: { ...b.bounds, y: b.bounds.y + box.h }, style: { ...b.style, locked: false }, container: b.container && idMap.has(b.container.id) ? { ...b.container, id: idMap.get(b.container.id)! } : b.container }));
  return { ok: true, canvas: replacePage(c, scope.page, settleBlocks([...scope.page.blocks, ...copies], copies.map((b) => b.id))), skipped: scope.skipped };
}

/** Locking and hiding work on locked blocks too (unlocking has to). */
export function setFlag(c: Canvas, ids: readonly string[], flag: "locked" | "hidden", value: boolean): ArrangeResult {
  if (ids.length === 0) return fail("Select a block first.");
  const page = pageOf(c, ids[0]!);
  if (!page || ids.some((i) => !page.blocks.some((b) => b.id === i))) return fail("Select blocks on one page.");
  const chosen = new Set(ids);
  const next = page.blocks.map((b) => (chosen.has(b.id) ? { ...b, style: { ...b.style, [flag]: value } } : b));
  if (next.every((b, i) => JSON.stringify(b) === JSON.stringify(page.blocks[i]))) return fail("Nothing would change.");
  return { ok: true, canvas: replacePage(c, page, next), skipped: [] };
}
