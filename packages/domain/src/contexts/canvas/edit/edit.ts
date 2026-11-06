/**
 * Editing a canvas (Phase 45.3): pure functions from a canvas to a new canvas or a reason. The editor, keyboard handlers and
 * the API's patch endpoint all call these, so a gesture means the same everywhere. Nothing mutates its input.
 */
import { settleBoxes } from "./layout.js";
import { CANVAS_GRID_COLUMNS, CANVAS_MAX_BLOCKS_PER_PAGE, CANVAS_MAX_PAGES, type BlockInstance, type Canvas, type CanvasBounds, type CanvasPage } from "../canvas.js";
import { definitionFor } from "../blocks/registry.js";

export type EditResult = { ok: true; canvas: Canvas } | { ok: false; reason: string };
const fail = (reason: string): EditResult => ({ ok: false, reason });
const done = (canvas: Canvas): EditResult => ({ ok: true, canvas });

const mapPage = (c: Canvas, pageId: string, f: (p: CanvasPage) => CanvasPage | string): EditResult => {
  const i = c.pages.findIndex((p) => p.id === pageId);
  if (i < 0) return fail("That page does not exist.");
  const next = f(c.pages[i]!);
  if (typeof next === "string") return fail(next);
  return done({ ...c, pages: c.pages.map((p, j) => (j === i ? next : p)) });
};

/** Blocks laid out by their grid cells with the shared rule (a dropped block keeps its place, the rest fall to the highest free row). */
function settle(blocks: BlockInstance[], pinnedId?: string): BlockInstance[] {
  const boxes = blocks.map((b) => ({ id: b.id, ...b.bounds, block: b }));
  return settleBoxes(boxes, pinnedId).map(({ block, x, y, w, h }) => ({ ...block, bounds: { x, y, w, h } }));
}

export function addBlock(c: Canvas, pageId: string, input: { id: string; kind: string; props?: unknown }): EditResult {
  const def = definitionFor(input.kind);
  if (!def) return fail("This block is not one the product knows.");
  return mapPage(c, pageId, (p) => {
    if (p.blocks.length >= CANVAS_MAX_BLOCKS_PER_PAGE) return `A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.`;
    if (c.pages.some((q) => q.blocks.some((b) => b.id === input.id))) return "Two blocks share an id.";
    const { w, h } = def.sizes.default;
    const y = p.blocks.reduce((m, b) => Math.max(m, b.bounds.y + b.bounds.h), 0);
    const block: BlockInstance = { id: input.id, kind: input.kind, bounds: { x: 0, y, w, h }, props: input.props ?? def.defaults(), bindings: [] };
    return { ...p, blocks: settle([...p.blocks, block]) };
  });
}

const findBlock = (c: Canvas, id: string): { page: CanvasPage; block: BlockInstance } | null => {
  for (const page of c.pages) { const block = page.blocks.find((b) => b.id === id); if (block) return { page, block }; }
  return null;
};

/** Changes a block, refusing a locked one and a result that breaks the block's size limits. */
function changeBlock(c: Canvas, id: string, f: (b: BlockInstance) => BlockInstance | string, pinned = false): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  if (hit.block.style?.locked) return fail("That block is locked.");
  const next = f(hit.block);
  if (typeof next === "string") return fail(next);
  return mapPage(c, hit.page.id, (p) => ({ ...p, blocks: settle(p.blocks.map((b) => (b.id === id ? next : b)), pinned ? id : undefined) }));
}

export const moveBlock = (c: Canvas, id: string, x: number, y: number): EditResult =>
  changeBlock(c, id, (b) => (x < 0 || y < 0 || x + b.bounds.w > CANVAS_GRID_COLUMNS ? "A block cannot leave the page." : { ...b, bounds: { ...b.bounds, x, y } }), true);

export const resizeBlock = (c: Canvas, id: string, w: number, h: number): EditResult =>
  changeBlock(c, id, (b) => {
    const s = definitionFor(b.kind)?.sizes;
    if (!s) return "This block is not one the product knows.";
    if (w < s.min.w || h < s.min.h) return `This block is at least ${s.min.w} wide and ${s.min.h} high.`;
    if (w > s.max.w || h > s.max.h) return `This block is at most ${s.max.w} wide and ${s.max.h} high.`;
    if (b.bounds.x + w > CANVAS_GRID_COLUMNS) return "A block cannot leave the page.";
    return { ...b, bounds: { ...b.bounds, w, h } };
  }, true);

export const updateProps = (c: Canvas, id: string, props: unknown): EditResult => changeBlock(c, id, (b) => ({ ...b, props }));
export const setBindings = (c: Canvas, id: string, bindings: BlockInstance["bindings"]): EditResult => changeBlock(c, id, (b) => ({ ...b, bindings }));
export const setBlockAlt = (c: Canvas, id: string, alt: string | undefined, description?: string): EditResult => changeBlock(c, id, (b) => ({ ...b, alt, description }));

/** Lock/unlock is the one change a locked block still accepts. */
export function setLocked(c: Canvas, id: string, locked: boolean): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  return mapPage(c, hit.page.id, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, style: { ...b.style, locked } } : b)) }));
}

export function setHidden(c: Canvas, id: string, hidden: boolean): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  return mapPage(c, hit.page.id, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, style: { ...b.style, hidden } } : b)) }));
}

export function removeBlock(c: Canvas, id: string): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  if (hit.block.style?.locked) return fail("That block is locked.");
  return mapPage(c, hit.page.id, (p) => ({ ...p, blocks: settle(p.blocks.filter((b) => b.id !== id)) }));
}

/** A copy goes just below the original, unlocked, with its own id and a deep copy of its settings. */
export function duplicateBlock(c: Canvas, id: string, newId: string): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  if (c.pages.some((p) => p.blocks.some((b) => b.id === newId))) return fail("Two blocks share an id.");
  if (hit.page.blocks.length >= CANVAS_MAX_BLOCKS_PER_PAGE) return fail(`A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.`);
  const copy: BlockInstance = { ...structuredClone(hit.block), id: newId, bounds: { ...hit.block.bounds, y: hit.block.bounds.y + hit.block.bounds.h }, style: { ...hit.block.style, locked: false } };
  return mapPage(c, hit.page.id, (p) => ({ ...p, blocks: settle([...p.blocks, copy], newId) }));
}

export function addPage(c: Canvas, input: { id: string; title: string; format?: string }): EditResult {
  if (c.pages.length >= CANVAS_MAX_PAGES) return fail(`A canvas has at most ${CANVAS_MAX_PAGES} pages.`);
  if (c.pages.some((p) => p.id === input.id)) return fail("Two pages share an id.");
  return done({ ...c, pages: [...c.pages, { id: input.id, title: input.title, format: input.format ?? c.pages[0]?.format ?? "WEB_FLUID", blocks: [] }] });
}

export function removePage(c: Canvas, pageId: string): EditResult {
  if (c.pages.length <= 1) return fail("A canvas keeps at least one page.");
  return c.pages.some((p) => p.id === pageId) ? done({ ...c, pages: c.pages.filter((p) => p.id !== pageId) }) : fail("That page does not exist.");
}

export function movePage(c: Canvas, pageId: string, toIndex: number): EditResult {
  const from = c.pages.findIndex((p) => p.id === pageId);
  if (from < 0) return fail("That page does not exist.");
  const to = Math.max(0, Math.min(c.pages.length - 1, toIndex));
  const pages = [...c.pages];
  const [p] = pages.splice(from, 1);
  pages.splice(to, 0, p!);
  return done({ ...c, pages });
}

/** Moves a block to another page, at the bottom. */
export function moveBlockToPage(c: Canvas, id: string, pageId: string): EditResult {
  const hit = findBlock(c, id);
  if (!hit) return fail("That block does not exist.");
  if (hit.block.style?.locked) return fail("That block is locked.");
  if (hit.page.id === pageId) return done(c);
  const target = c.pages.find((p) => p.id === pageId);
  if (!target) return fail("That page does not exist.");
  if (target.blocks.length >= CANVAS_MAX_BLOCKS_PER_PAGE) return fail(`A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.`);
  const y = target.blocks.reduce((m, b) => Math.max(m, b.bounds.y + b.bounds.h), 0);
  const moved: BlockInstance = { ...hit.block, bounds: { ...hit.block.bounds, x: 0, y } };
  return done({ ...c, pages: c.pages.map((p) => (p.id === hit.page.id ? { ...p, blocks: settle(p.blocks.filter((b) => b.id !== id)) } : p.id === pageId ? { ...p, blocks: settle([...p.blocks, moved]) } : p)) });
}

export const setTitle = (c: Canvas, title: string): EditResult => done({ ...c, title });
export type { CanvasBounds };
