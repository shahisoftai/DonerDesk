/**
 * Selecting blocks (Phase 48.1): pure rules, no DOM. A selection is a list of block ids on one page; the editor draws it and the
 * gestures in `arrange.ts` act on it. Every function returns a new selection and never throws on an unknown id (a block that was
 * deleted simply drops out), so undo and redo can restore a selection that no longer fits.
 */
import type { BlockInstance, Canvas, CanvasPage } from "../canvas.js";

export interface Selection { ids: readonly string[]; /** The block a shift-click range starts from. */ anchor?: string | undefined }
export const EMPTY_SELECTION: Selection = { ids: [] };

export interface Rect { x: number; y: number; w: number; h: number }

/** Reading order: top to bottom, then left to right. This is the order a screen reader and a phone layout follow. */
export const blocksInReadingOrder = (blocks: ReadonlyArray<BlockInstance>): BlockInstance[] =>
  [...blocks].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x || a.id.localeCompare(b.id));

const topLevel = (page: CanvasPage): BlockInstance[] => page.blocks.filter((b) => !b.container && !b.style?.hidden);

export function pageOf(c: Canvas, blockId: string): CanvasPage | undefined {
  return c.pages.find((p) => p.blocks.some((b) => b.id === blockId));
}

export const selectOne = (id: string): Selection => ({ ids: [id], anchor: id });

/** Ctrl/⌘-click: adds the block, or takes it out when it is already selected. Another page starts a new selection. */
export function toggle(c: Canvas, sel: Selection, id: string): Selection {
  const page = pageOf(c, id);
  if (!page) return sel;
  const current = sel.ids.filter((i) => page.blocks.some((b) => b.id === i));
  return current.includes(id) ? { ids: current.filter((i) => i !== id), anchor: current.filter((i) => i !== id).at(-1) } : { ids: [...current, id], anchor: id };
}

/** Shift-click: everything between the anchor and the clicked block in reading order. */
export function extendTo(c: Canvas, sel: Selection, id: string): Selection {
  const page = pageOf(c, id);
  if (!page) return sel;
  const anchor = sel.anchor && page.blocks.some((b) => b.id === sel.anchor) ? sel.anchor : id;
  const order = blocksInReadingOrder(topLevel(page)).map((b) => b.id);
  const a = order.indexOf(anchor), b = order.indexOf(id);
  if (a < 0 || b < 0) return selectOne(id);
  return { ids: order.slice(Math.min(a, b), Math.max(a, b) + 1), anchor };
}

export const selectAll = (page: CanvasPage): Selection => ({ ids: blocksInReadingOrder(topLevel(page)).map((b) => b.id), anchor: blocksInReadingOrder(topLevel(page))[0]?.id });

/** The blocks a container holds (select-within-container). */
export const selectInside = (page: CanvasPage, containerId: string): Selection => ({ ids: blocksInReadingOrder(page.blocks.filter((b) => b.container?.id === containerId)).map((b) => b.id) });

export function selectSameKind(page: CanvasPage, id: string): Selection {
  const kind = page.blocks.find((b) => b.id === id)?.kind;
  return kind ? { ids: blocksInReadingOrder(topLevel(page).filter((b) => b.kind === kind)).map((b) => b.id), anchor: id } : EMPTY_SELECTION;
}

const touches = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Marquee (lasso): every visible top-level block that the dragged rectangle touches; `add` keeps what was already selected. */
export function marquee(page: CanvasPage, rect: Rect, keep: Selection = EMPTY_SELECTION): Selection {
  const hit = topLevel(page).filter((b) => touches(rect, b.bounds)).map((b) => b.id);
  const ids = [...new Set([...keep.ids, ...hit])];
  return { ids, anchor: hit[0] ?? keep.anchor };
}

/** Drops ids that no longer exist or sit on different pages, so a stale selection never reaches a gesture. */
export function pruneSelection(c: Canvas, sel: Selection): Selection {
  const first = sel.ids.map((i) => pageOf(c, i)).find(Boolean);
  if (!first) return EMPTY_SELECTION;
  const ids = sel.ids.filter((i) => first.blocks.some((b) => b.id === i));
  return { ids, anchor: sel.anchor && ids.includes(sel.anchor) ? sel.anchor : ids[0] };
}

/** The union of the selected blocks' cells (for the selection frame and for grouping). */
export function boundsOf(blocks: ReadonlyArray<BlockInstance>): Rect | null {
  if (blocks.length === 0) return null;
  const x = Math.min(...blocks.map((b) => b.bounds.x)), y = Math.min(...blocks.map((b) => b.bounds.y));
  return { x, y, w: Math.max(...blocks.map((b) => b.bounds.x + b.bounds.w)) - x, h: Math.max(...blocks.map((b) => b.bounds.y + b.bounds.h)) - y };
}
