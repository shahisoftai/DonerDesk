/**
 * Everything wrong with a canvas, as sentences (Phase 45). Block rules come from each block's own definition; this file knows
 * the page, the grid and the limits, and never a block by name.
 */
import { containerProblems } from "./containers.js";
import { bindingProblems } from "./binding.js";
import { actionProblems } from "./actions.js";
import { paramBindingProblems, parameterProblems } from "./params.js";
import { definitionFor, pictureOfBlock } from "./blocks/registry.js";
import { animationProblems } from "./motion.js";
import { formatProblems } from "./format/capabilities.js";
import { freeFrameProblems, pageExtent } from "./pages.js";
import { interactionProblems } from "./interactions.js";
import { importThemeSpec } from "./theme-kit/theme-json.js";
import { CANVAS_MODES, CANVAS_PROFILES, CANVAS_SCOPES, CANVAS_GRID_COLUMNS, CANVAS_MAX_BLOCKS_PER_PAGE, CANVAS_MAX_PAGES, CANVAS_MAX_TITLE, type BlockInstance, type CanvasBounds, type Canvas } from "./canvas.js";

export interface CanvasProblem { pageId: string; blockId: string; message: string }

const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const boundsOk = (b: CanvasBounds): boolean => [b.x, b.y, b.w, b.h].every(whole) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= CANVAS_GRID_COLUMNS;

/** What would break the page if it were stored or drawn: an unknown kind, a position outside the grid. */
function blockStructure(block: BlockInstance, pageId: string, pageSize?: { w: number; h: number }): CanvasProblem[] {
  const out: CanvasProblem[] = [];
  const add = (message: string) => out.push({ pageId, blockId: block.id, message });
  const def = definitionFor(block.kind);
  if (!def) { add("This block is not one the product knows."); return out; }
  if (!boundsOk(block.bounds)) add("A block's place and size must be whole cells inside the page.");
  // Any size is the person's choice (Phase 61.3): a block's own minimum and maximum are no longer checked; only its place on the page is.
  if (block.free && pageSize) for (const m of freeFrameProblems(block.free, pageSize)) add(m);
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
  const params = canvas.params ?? [];
  for (const p of parameterProblems(params, new Set(canvas.pages.map((q) => q.id)))) out.push({ pageId: "", blockId: "", message: p.message });
  const top = (message: string) => out.push({ pageId: "", blockId: "", message });
  if (!canvas.title.trim() || canvas.title.length > CANVAS_MAX_TITLE) top(`A title is 1 to ${CANVAS_MAX_TITLE} characters.`);
  if (!CANVAS_MODES.includes(canvas.mode)) top("Unknown mode.");
  if (!CANVAS_SCOPES.includes(canvas.scope)) top("Unknown scope.");
  if (!CANVAS_PROFILES.includes(canvas.profile)) top("Unknown profile.");
  if (canvas.pages.length === 0) top("A canvas has at least one page.");
  for (const m of interactionProblems(canvas)) top(m);
  if (canvas.options?.themeSpec) { const r = importThemeSpec(JSON.stringify(canvas.options.themeSpec)); if (!r.ok) top(`The loaded theme cannot be used: ${r.problems[0]}`); }
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
      out.push(...blockStructure(block, page.id, pageExtent(page) ?? undefined));
      for (const message of containerProblems(page, block)) out.push({ pageId: page.id, blockId: block.id, message });
      for (const message of paramBindingProblems(block.paramBindings ?? [], params)) out.push({ pageId: page.id, blockId: block.id, message });
      for (const message of formatProblems(block.kind, block.format)) out.push({ pageId: page.id, blockId: block.id, message });
      if (block.motion) for (const message of animationProblems(block.motion, pictureOfBlock(block))) out.push({ pageId: page.id, blockId: block.id, message });
      if (block.action) for (const message of actionProblems(block.action, { pageIds: new Set(canvas.pages.map((q) => q.id)), params })) out.push({ pageId: page.id, blockId: block.id, message });
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
