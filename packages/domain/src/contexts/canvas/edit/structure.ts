/**
 * Structural gestures (Phase 48.1): group, ungroup and change a block's kind. Pure, like the rest of `edit/`. Which kind is a container is
 * a trait of the block's definition (never a name), and what a kind change would lose is named before it happens.
 */
import { CANVAS_MAX_BLOCKS_PER_PAGE, type BlockInstance, type Canvas } from "../canvas.js";
import { definitionFor } from "../blocks/registry.js";
import { containerRole, isContainerKind } from "../containers.js";
import { settleBlocks, setContainer } from "./edit.js";
import { boundsOf, pageOf } from "./selection.js";
import type { ArrangeResult } from "./arrange.js";

const fail = (reason: string): ArrangeResult => ({ ok: false, reason });

/** The kind that frames a group: the container whose role is FRAME. */
const frameKind = (): string | undefined => ["GROUP"].find((k) => containerRole(k) === "FRAME");

/** Puts the selected top-level blocks into a new group (a frame container) that covers them. */
export function groupBlocks(c: Canvas, ids: readonly string[], groupId: string): ArrangeResult {
  const kind = frameKind();
  if (!kind) return fail("Groups are not available.");
  const page = ids[0] ? pageOf(c, ids[0]) : undefined;
  if (!page || ids.length < 2) return fail("Select at least 2 blocks to group.");
  const chosen = ids.map((i) => page.blocks.find((b) => b.id === i));
  if (chosen.some((b) => !b)) return fail("Select blocks on one page.");
  const blocks = chosen as BlockInstance[];
  if (blocks.some((b) => b.style?.locked)) return fail("A locked block cannot be grouped.");
  if (blocks.some((b) => b.container || isContainerKind(b.kind))) return fail("A group holds plain blocks, not other groups or tabs.");
  if (c.pages.some((p) => p.blocks.some((b) => b.id === groupId))) return fail("Two blocks share an id.");
  if (page.blocks.length >= CANVAS_MAX_BLOCKS_PER_PAGE) return fail(`A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.`);
  const box = boundsOf(blocks)!;
  const def = definitionFor(kind)!;
  const group: BlockInstance = { id: groupId, kind, bounds: { x: box.x, y: box.y, w: box.w, h: box.h }, props: def.defaults(), bindings: [] };
  let next: Canvas = { ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks: settleBlocks([...p.blocks, group], groupId) } : p)) };
  for (const b of blocks) {
    const r = setContainer(next, b.id, { id: groupId });
    if (!r.ok) return fail(r.reason);
    next = r.canvas;
  }
  return { ok: true, canvas: next, skipped: [] };
}

/** Takes a container's blocks back onto the page and removes the container. */
export function ungroup(c: Canvas, containerId: string): ArrangeResult {
  const page = pageOf(c, containerId);
  const holder = page?.blocks.find((b) => b.id === containerId);
  if (!page || !holder || !isContainerKind(holder.kind)) return fail("That is not a group.");
  if (holder.style?.locked) return fail("That block is locked.");
  const rest = page.blocks.filter((b) => b.id !== containerId).map((b) => (b.container?.id === containerId ? { ...b, container: undefined } : b));
  return { ok: true, canvas: { ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks: settleBlocks(rest) } : p)) }, skipped: [] };
}

/** The settings of the old block a new kind has no place for, as the names a person would read. */
export function conversionLosses(block: BlockInstance, newKind: string): string[] {
  const target = definitionFor(newKind);
  if (!target) return [];
  const kept = new Set(Object.keys((target.defaults() as Record<string, unknown>) ?? {}));
  const props = (block.props ?? {}) as Record<string, unknown>;
  return Object.keys(props).filter((k) => !kept.has(k) && props[k] !== undefined && props[k] !== "" && !(Array.isArray(props[k]) && (props[k] as unknown[]).length === 0));
}

/**
 * Changes a block's kind in place, keeping its place, size (within the new limits), data bindings and the settings both kinds share.
 * Refused, naming what would be lost, unless `acceptLoss` is set; a container or a block that is in a container is never converted.
 */
export function convertBlock(c: Canvas, id: string, newKind: string, acceptLoss = false): ArrangeResult {
  const page = pageOf(c, id);
  const block = page?.blocks.find((b) => b.id === id);
  const target = definitionFor(newKind);
  if (!page || !block) return fail("That block does not exist.");
  if (!target) return fail("This block is not one the product knows.");
  if (block.style?.locked) return fail("That block is locked.");
  if (block.kind === newKind) return fail("Nothing would change.");
  if (isContainerKind(block.kind) || isContainerKind(newKind) || block.container) return fail("Groups, tabs and repeaters cannot be converted, and a block inside one cannot change kind.");
  const lost = conversionLosses(block, newKind);
  if (lost.length > 0 && !acceptLoss) return fail(`Changing the kind would drop: ${lost.join(", ")}.`);
  const defaults = target.defaults() as Record<string, unknown>;
  const old = (block.props ?? {}) as Record<string, unknown>;
  const props = { ...defaults, ...Object.fromEntries(Object.keys(defaults).filter((k) => old[k] !== undefined).map((k) => [k, old[k]])) };
  const { min, max } = target.sizes;
  const w = Math.min(max.w, Math.max(min.w, block.bounds.w)), h = Math.min(max.h, Math.max(min.h, block.bounds.h));
  const next: BlockInstance = { ...block, kind: newKind, props, bounds: { ...block.bounds, w, h, x: Math.min(block.bounds.x, 12 - w) } };
  const blocks = settleBlocks(page.blocks.map((b) => (b.id === id ? next : b)), id);
  return { ok: true, canvas: { ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks } : p)) }, skipped: [] };
}
