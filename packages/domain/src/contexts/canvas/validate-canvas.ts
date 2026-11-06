/**
 * Everything wrong with a canvas, as sentences (Phase 45). Block rules come from each block's own definition; this file knows
 * the page, the grid and the limits, and never a block by name.
 */
import { bindingProblems } from "./binding.js";
import { definitionFor } from "./blocks/registry.js";
import { CANVAS_MODES, CANVAS_PROFILES, CANVAS_SCOPES, CANVAS_GRID_COLUMNS, CANVAS_MAX_BLOCKS_PER_PAGE, CANVAS_MAX_PAGES, CANVAS_MAX_TITLE, type BlockInstance, type CanvasBounds, type Canvas } from "./canvas.js";

export interface CanvasProblem { pageId: string; blockId: string; message: string }

const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const boundsOk = (b: CanvasBounds): boolean => [b.x, b.y, b.w, b.h].every(whole) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= CANVAS_GRID_COLUMNS;

/** What would break the page if it were stored or drawn: an unknown kind, a position outside the grid. */
function blockStructure(block: BlockInstance, pageId: string): CanvasProblem[] {
  const out: CanvasProblem[] = [];
  const add = (message: string) => out.push({ pageId, blockId: block.id, message });
  const def = definitionFor(block.kind);
  if (!def) { add("This block is not one the product knows."); return out; }
  if (!boundsOk(block.bounds)) add("A block's place and size must be whole cells inside the page.");
  else {
    const { min, max } = def.sizes;
    if (block.bounds.w < min.w || block.bounds.h < min.h) add(`This block is at least ${min.w} wide and ${min.h} high.`);
    if (block.bounds.w > max.w || block.bounds.h > max.h) add(`This block is at most ${max.w} wide and ${max.h} high.`);
  }
  for (const alt of [block.tablet, block.phone]) if (alt && !boundsOk(alt)) add("A tablet or phone position must stay inside the page.");
  return out;
}

/** What is not set up yet: a block that needs its indicator, a figure with no source. Informs the editor; does not stop a save. */
function blockContent(block: BlockInstance, pageId: string): CanvasProblem[] {
  const out: CanvasProblem[] = [];
  const add = (message: string) => out.push({ pageId, blockId: block.id, message });
  const def = definitionFor(block.kind);
  if (!def) return out;
  for (const p of (def as { validate(p: unknown): Array<{ message: string }> }).validate(block.props)) add(p.message);
  for (const p of bindingProblems(def.slots, block.bindings)) add(p.message);
  return out;
}

/** Everything wrong with the canvas's shape: the title, pages, ids, limits, and each block's kind and position. A canvas with any of these is refused when saved. */
export function canvasStructureProblems(canvas: Canvas): CanvasProblem[] {
  const out: CanvasProblem[] = [];
  const top = (message: string) => out.push({ pageId: "", blockId: "", message });
  if (!canvas.title.trim() || canvas.title.length > CANVAS_MAX_TITLE) top(`A title is 1 to ${CANVAS_MAX_TITLE} characters.`);
  if (!CANVAS_MODES.includes(canvas.mode)) top("Unknown mode.");
  if (!CANVAS_SCOPES.includes(canvas.scope)) top("Unknown scope.");
  if (!CANVAS_PROFILES.includes(canvas.profile)) top("Unknown profile.");
  if (canvas.pages.length === 0) top("A canvas has at least one page.");
  if (canvas.pages.length > CANVAS_MAX_PAGES) top(`A canvas has at most ${CANVAS_MAX_PAGES} pages.`);
  const pageIds = new Set<string>();
  const blockIds = new Set<string>();
  for (const page of canvas.pages) {
    if (pageIds.has(page.id)) top("Two pages share an id.");
    pageIds.add(page.id);
    if (page.blocks.length > CANVAS_MAX_BLOCKS_PER_PAGE) out.push({ pageId: page.id, blockId: "", message: `A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.` });
    for (const block of page.blocks) {
      if (blockIds.has(block.id)) out.push({ pageId: page.id, blockId: block.id, message: "Two blocks share an id." });
      blockIds.add(block.id);
      out.push(...blockStructure(block, page.id));
    }
  }
  return out;
}

/** What is not set up yet, block by block. */
export function canvasContentProblems(canvas: Canvas): CanvasProblem[] {
  return canvas.pages.flatMap((page) => page.blocks.flatMap((block) => blockContent(block, page.id)));
}

/** Everything wrong with a canvas, as sentences: its shape, then what is not set up. A canvas must have none to be shared or published. */
export const canvasProblems = (canvas: Canvas): CanvasProblem[] => [...canvasStructureProblems(canvas), ...canvasContentProblems(canvas)];
