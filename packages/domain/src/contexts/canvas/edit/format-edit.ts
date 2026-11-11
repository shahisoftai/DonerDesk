/**
 * Changing a block's formatting (Phase 50.2), for one block or for every selected block at once (the edit drawer shows only the
 * sections the selected blocks share). One call is one undo step; a locked block is left as it is and named; a block that does not offer
 * the capability is left alone and named; the result is checked by the capability's own rules, so a bad setting is refused, never saved.
 */
import type { BlockInstance, Canvas } from "../canvas.js";
import { formatProblems, formatsOf } from "../format/capabilities.js";
import type { BlockFormat, FormatCapability } from "../format/types.js";
import type { ArrangeResult } from "./arrange.js";

const mapBlocks = (canvas: Canvas, f: (b: BlockInstance) => BlockInstance): Canvas => ({ ...canvas, pages: canvas.pages.map((p) => ({ ...p, blocks: p.blocks.map(f) })) });

/** Sets (or, with `undefined`, resets to the default) one capability's settings on the given blocks. */
export function setBlockFormat<K extends FormatCapability>(canvas: Canvas, ids: readonly string[], capability: K, settings: BlockFormat[K] | undefined): ArrangeResult {
  const wanted = new Set(ids);
  const all = canvas.pages.flatMap((p) => p.blocks).filter((b) => wanted.has(b.id));
  if (all.length === 0) return { ok: false, reason: "Select a block first." };
  const skipped: string[] = [];
  const changing: BlockInstance[] = [];
  for (const b of all) {
    if (b.style?.locked) skipped.push(b.id);
    else if (!formatsOf(b.kind).includes(capability)) skipped.push(b.id);
    else changing.push(b);
  }
  if (changing.length === 0) return { ok: false, reason: "None of the selected blocks can take that change." };
  const next = new Map<string, BlockInstance>();
  for (const b of changing) {
    const format: BlockFormat = { ...(b.format ?? {}) };
    if (settings === undefined) delete format[capability]; else format[capability] = settings;
    const problems = formatProblems(b.kind, format);
    if (problems.length) return { ok: false, reason: problems[0]! };
    next.set(b.id, { ...b, format: Object.keys(format).length ? format : undefined });
  }
  if (changing.every((b) => JSON.stringify(b.format?.[capability]) === JSON.stringify(next.get(b.id)!.format?.[capability]))) return { ok: false, reason: "Nothing changed." };
  return { ok: true, canvas: mapBlocks(canvas, (b) => next.get(b.id) ?? b), skipped };
}

/** The capabilities every one of the blocks offers: what the edit drawer shows when several are selected. */
export function sharedCapabilities(blocks: ReadonlyArray<Pick<BlockInstance, "kind">>): FormatCapability[] {
  if (blocks.length === 0) return [];
  const [first, ...rest] = blocks.map((b) => formatsOf(b.kind));
  return (first ?? []).filter((c) => rest.every((r) => r.includes(c)));
}

/** Copies one block's formatting to others (Power BI's format painter): only the capabilities each target offers. */
export function pasteFormat(canvas: Canvas, fromId: string, toIds: readonly string[]): ArrangeResult {
  const from = canvas.pages.flatMap((p) => p.blocks).find((b) => b.id === fromId);
  if (!from?.format) return { ok: false, reason: "That block has no formatting to copy." };
  const wanted = new Set(toIds.filter((id) => id !== fromId));
  const skipped: string[] = [];
  let changed = false;
  const out = mapBlocks(canvas, (b) => {
    if (!wanted.has(b.id)) return b;
    if (b.style?.locked) { skipped.push(b.id); return b; }
    const offered = new Set(formatsOf(b.kind));
    const format = Object.fromEntries(Object.entries(from.format!).filter(([k]) => offered.has(k as FormatCapability))) as BlockFormat;
    if (Object.keys(format).length === 0) { skipped.push(b.id); return b; }
    changed = true;
    return { ...b, format: { ...(b.format ?? {}), ...format } };
  });
  return changed ? { ok: true, canvas: out, skipped } : { ok: false, reason: "None of the selected blocks can take that formatting." };
}
