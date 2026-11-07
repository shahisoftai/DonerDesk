/**
 * Container blocks (Phase 45): a group, tabs and a repeater hold other blocks of the same page. A held block is drawn inside its container,
 * not on the page grid, so the page grid only lays out `topLevel` blocks. One level only: a container cannot sit in another. Pure.
 */
import type { BlockInstance, CanvasPage } from "./canvas.js";
import { definitionFor } from "./blocks/registry.js";

export const isContainerKind = (kind: string): boolean => definitionFor(kind)?.container !== undefined;
export const containerRole = (kind: string): "FRAME" | "TABS" | "REPEAT" | undefined => definitionFor(kind)?.container;
export const topLevel = (blocks: readonly BlockInstance[]): BlockInstance[] => blocks.filter((b) => !b.container);

/** The blocks held by a container, in reading order; for tabs, only those in one tab when `tab` is given. */
export function childrenOf(blocks: readonly BlockInstance[], containerId: string, tab?: number): BlockInstance[] {
  return blocks
    .filter((b) => b.container?.id === containerId && (tab === undefined || (b.container.tab ?? 0) === tab))
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
}

/** What is wrong with a block's place in a container, as sentences. */
export function containerProblems(page: CanvasPage, block: BlockInstance): string[] {
  const c = block.container;
  if (!c) return [];
  const holder = page.blocks.find((b) => b.id === c.id);
  if (!holder || !isContainerKind(holder.kind)) return ["This block sits in a container that is not on the page."];
  if (holder.container) return ["A container cannot sit inside another."];
  if (isContainerKind(block.kind)) return ["A container cannot be put inside another container."];
  if (holder.id === block.id) return ["A block cannot hold itself."];
  const titles = (holder.props as { titles?: unknown } | undefined)?.titles;
  const tabs = Array.isArray(titles) ? titles.length : 0;
  if (c.tab !== undefined && (!Number.isInteger(c.tab) || c.tab < 0 || (tabs > 0 ? c.tab >= tabs : c.tab > 0))) return ["That tab does not exist."];
  return [];
}

/** The id a repeated copy of a block is known by: the block and the item it was repeated for. */
export const repeatKey = (blockId: string, itemKey: string): string => `${blockId}::${itemKey}`;
export const REPEAT_OVER = ["PROJECT", "PLACE"] as const;
