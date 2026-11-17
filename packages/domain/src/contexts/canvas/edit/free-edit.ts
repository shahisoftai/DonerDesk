/**
 * Editing a FREE page (Phase 61.3): the same gestures as on a grid (move, resize, nudge, align, distribute, match size), written on pixel
 * frames. A block on a free page keeps its grid cells in step (`bounds`), so a page can go back to a grid and the older file painters
 * still read a position. Pure functions from a canvas to a canvas or a reason, like `edit.ts`; a locked block is never changed.
 */
import { type BlockInstance, type Canvas, type CanvasPage, type FreeFrame } from "../canvas.js";
import { cellsFromFrame, frameFromCells, freeFrameProblems, pagePresetById } from "../pages.js";
import type { EditResult } from "./edit.js";

/** The smallest a block may be on a free page. Every size above this is the person's choice; a block that cannot draw this small says so itself. */
export const FREE_MIN_PX = 24;
export const FREE_MAX_PX = 6000;

const fail = (reason: string): EditResult => ({ ok: false, reason });
const marginOf = (page: CanvasPage): number => pagePresetById(page.format)?.margin ?? 24;

const pageHolding = (c: Canvas, id: string): CanvasPage | undefined => c.pages.find((p) => p.blocks.some((b) => b.id === id));
export const isFreePage = (page: CanvasPage | undefined): page is CanvasPage & { size: { w: number; h: number } } => page?.mode === "FREE" && Boolean(page.size);

/** A block's frame on a free page: its own, or the one its grid cells give. */
export function frameOf(b: BlockInstance, page: CanvasPage): FreeFrame {
  if (b.free) return b.free;
  return frameFromCells(b, page.size ?? { w: 1280 }, marginOf(page));
}

const clampFrame = (f: FreeFrame): FreeFrame => {
  const w = Math.min(FREE_MAX_PX, Math.max(FREE_MIN_PX, Math.round(f.w)));
  const h = Math.min(FREE_MAX_PX, Math.max(FREE_MIN_PX, Math.round(f.h)));
  return { ...f, x: Math.round(f.x), y: Math.max(-h + FREE_MIN_PX, Math.round(f.y)), w, h };
};

const withFrame = (b: BlockInstance, page: CanvasPage, frame: FreeFrame): BlockInstance => ({
  ...b,
  free: frame,
  bounds: cellsFromFrame(frame, page.size ?? { w: 1280 }, marginOf(page)),
});

const replace = (c: Canvas, page: CanvasPage, blocks: BlockInstance[]): Canvas => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...page, blocks } : p)) });

/** Sets part of a block's frame (position, size, rotation, stacking). Any size from the floor up is allowed. */
export function setFrame(c: Canvas, id: string, patch: Partial<FreeFrame>): EditResult {
  const page = pageHolding(c, id);
  if (!page) return fail("That block does not exist.");
  if (!isFreePage(page)) return fail("This page places blocks on a grid.");
  const block = page.blocks.find((b) => b.id === id)!;
  if (block.style?.locked) return fail("That block is locked.");
  const next = clampFrame({ ...frameOf(block, page), ...patch });
  const problems = freeFrameProblems(next, page.size).filter((m) => !m.startsWith("A block is at least"));
  if (problems.length > 0) return fail(problems[0]!);
  return { ok: true, canvas: replace(c, page, page.blocks.map((b) => (b.id === id ? withFrame(b, page, next) : b))) };
}

export type FreeArrangeResult = { ok: true; canvas: Canvas; skipped: string[] } | { ok: false; reason: string };
const failMany = (reason: string): FreeArrangeResult => ({ ok: false, reason });

interface Scope { page: CanvasPage & { size: { w: number; h: number } }; movable: BlockInstance[]; skipped: string[] }
function scopeOf(c: Canvas, ids: readonly string[], minimum = 1): Scope | string {
  if (ids.length === 0) return "Select a block first.";
  const page = pageHolding(c, ids[0]!);
  if (!page) return "That block does not exist.";
  if (!isFreePage(page)) return "This page places blocks on a grid.";
  const chosen = ids.map((i) => page.blocks.find((b) => b.id === i));
  if (chosen.some((b) => !b)) return "Select blocks on one page.";
  const blocks = chosen as BlockInstance[];
  const movable = blocks.filter((b) => !b.style?.locked);
  const skipped = blocks.filter((b) => b.style?.locked).map((b) => b.id);
  if (movable.length < minimum) return skipped.length > 0 && blocks.length >= minimum ? "The selected blocks are locked." : `Select at least ${minimum} blocks.`;
  return { page, movable, skipped };
}

function apply(c: Canvas, scope: Scope, frames: ReadonlyMap<string, FreeFrame>): FreeArrangeResult {
  const changed = scope.movable.filter((b) => {
    const n = frames.get(b.id);
    const o = frameOf(b, scope.page);
    return n && (n.x !== o.x || n.y !== o.y || n.w !== o.w || n.h !== o.h);
  });
  if (changed.length === 0) return failMany("Nothing would change.");
  const ids = new Set(changed.map((b) => b.id));
  const blocks = scope.page.blocks.map((b) => (ids.has(b.id) ? withFrame(b, scope.page, clampFrame(frames.get(b.id)!)) : b));
  return { ok: true, canvas: replace(c, scope.page, blocks), skipped: scope.skipped };
}

/** Moves blocks by pixels as a group. */
export function moveFrames(c: Canvas, ids: readonly string[], dx: number, dy: number): FreeArrangeResult {
  const scope = scopeOf(c, ids);
  if (typeof scope === "string") return failMany(scope);
  return apply(c, scope, new Map(scope.movable.map((b) => { const f = frameOf(b, scope.page); return [b.id, { ...f, x: f.x + dx, y: f.y + dy }]; })));
}

/** Arrow keys move one pixel step (Shift: ten times as far). */
export const nudgeFrames = (c: Canvas, ids: readonly string[], direction: "LEFT" | "RIGHT" | "UP" | "DOWN", big = false, step = 8): FreeArrangeResult => {
  const d = big ? step * 10 : step;
  return moveFrames(c, ids, direction === "LEFT" ? -d : direction === "RIGHT" ? d : 0, direction === "UP" ? -d : direction === "DOWN" ? d : 0);
};

export type FrameAlignment = "LEFT" | "CENTER" | "RIGHT" | "TOP" | "MIDDLE" | "BOTTOM";

export function alignFrames(c: Canvas, ids: readonly string[], how: FrameAlignment): FreeArrangeResult {
  const scope = scopeOf(c, ids, 2);
  if (typeof scope === "string") return failMany(scope);
  const fs = scope.movable.map((b) => ({ b, f: frameOf(b, scope.page) }));
  const left = Math.min(...fs.map((x) => x.f.x)), right = Math.max(...fs.map((x) => x.f.x + x.f.w));
  const top = Math.min(...fs.map((x) => x.f.y)), bottom = Math.max(...fs.map((x) => x.f.y + x.f.h));
  return apply(c, scope, new Map(fs.map(({ b, f }) => [b.id, how === "LEFT" ? { ...f, x: left } : how === "RIGHT" ? { ...f, x: right - f.w } : how === "CENTER" ? { ...f, x: Math.round(left + (right - left - f.w) / 2) }
    : how === "TOP" ? { ...f, y: top } : how === "BOTTOM" ? { ...f, y: bottom - f.h } : { ...f, y: Math.round(top + (bottom - top - f.h) / 2) }])));
}

/** Even gaps between three or more blocks; the outer two stay where they are. */
export function distributeFrames(c: Canvas, ids: readonly string[], axis: "HORIZONTAL" | "VERTICAL"): FreeArrangeResult {
  const scope = scopeOf(c, ids, 3);
  if (typeof scope === "string") return failMany(scope);
  const h = axis === "HORIZONTAL";
  const fs = scope.movable.map((b) => ({ b, f: frameOf(b, scope.page) })).sort((a, z) => (h ? a.f.x - z.f.x : a.f.y - z.f.y));
  const size = (f: FreeFrame): number => (h ? f.w : f.h);
  const start = h ? fs[0]!.f.x : fs[0]!.f.y;
  const last = fs[fs.length - 1]!.f;
  const end = h ? last.x + last.w : last.y + last.h;
  const gap = (end - start - fs.reduce((s, x) => s + size(x.f), 0)) / (fs.length - 1);
  let at = start;
  const out = new Map<string, FreeFrame>();
  for (const { b, f } of fs) { out.set(b.id, h ? { ...f, x: Math.round(at) } : { ...f, y: Math.round(at) }); at += size(f) + gap; }
  return apply(c, scope, out);
}

/** Gives every selected block the size of the first one. */
export function matchFrameSize(c: Canvas, ids: readonly string[], what: "WIDTH" | "HEIGHT" | "BOTH"): FreeArrangeResult {
  const scope = scopeOf(c, ids, 2);
  if (typeof scope === "string") return failMany(scope);
  const first = frameOf(scope.movable[0]!, scope.page);
  return apply(c, scope, new Map(scope.movable.map((b) => { const f = frameOf(b, scope.page); return [b.id, { ...f, w: what === "HEIGHT" ? f.w : first.w, h: what === "WIDTH" ? f.h : first.h }]; })));
}

/** Gives a block that has none the frame its grid cells give; a new block on a free page is placed below the others. */
export function frameForNewBlock(page: CanvasPage & { size: { w: number; h: number } }, b: BlockInstance): BlockInstance {
  const margin = marginOf(page);
  const bottom = page.blocks.reduce((m, o) => (o.container ? m : Math.max(m, frameOf(o, page).y + frameOf(o, page).h)), margin - 16);
  const base = frameFromCells({ ...b, bounds: { ...b.bounds, x: 0, y: 0 } }, page.size, margin);
  return withFrame(b, page, { ...base, x: margin, y: bottom + 16 });
}

/** Stacking order: one step up or down, or to the front or back. */
export function reorderFrame(c: Canvas, id: string, how: "FRONT" | "BACK" | "UP" | "DOWN"): EditResult {
  const page = pageHolding(c, id);
  if (!page) return fail("That block does not exist.");
  if (!isFreePage(page)) return fail("This page places blocks on a grid.");
  const zs = page.blocks.map((b) => frameOf(b, page).z ?? 0);
  const block = page.blocks.find((b) => b.id === id)!;
  const z = frameOf(block, page).z ?? 0;
  const next = how === "FRONT" ? Math.max(...zs) + 1 : how === "BACK" ? Math.min(...zs) - 1 : how === "UP" ? z + 1 : z - 1;
  return setFrame(c, id, { z: next });
}

/** Gives the named blocks of a free page the frames their grid cells give (after a starter set was laid out by cells); other blocks are unchanged. */
export function framesFromCells(c: Canvas, pageId: string, ids: readonly string[]): Canvas {
  const page = c.pages.find((p) => p.id === pageId);
  if (!isFreePage(page)) return c;
  const set = new Set(ids);
  const margin = marginOf(page);
  const blocks = page.blocks.map((b) => (set.has(b.id) && !b.container ? { ...b, free: frameFromCells(b, page.size, margin) } : b));
  return replace(c, page, blocks);
}
