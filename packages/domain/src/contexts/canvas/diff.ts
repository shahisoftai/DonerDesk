/**
 * Comparing two versions of a canvas (Phase 48.6): which blocks and pages were added, removed, moved or changed, and in what way. The
 * version history shows it as outlines on the page; the merge uses the same comparison. Blocks are matched by id, never by position.
 * Pure; compares stored documents, never data.
 */
import type { BlockInstance, Canvas, CanvasPage } from "./canvas.js";

export const BLOCK_FIELDS = ["kind", "bounds", "tablet", "phone", "free", "props", "bindings", "container", "style", "alt", "description", "component", "paramBindings", "action"] as const;
export type BlockField = (typeof BLOCK_FIELDS)[number];

export interface BlockChange { blockId: string; pageId: string; change: "ADDED" | "REMOVED" | "CHANGED"; fields: BlockField[] }
export interface PageChange { pageId: string; change: "ADDED" | "REMOVED" | "RENAMED" | "REORDERED" | "SETTINGS" }
export interface CanvasDiff { blocks: BlockChange[]; pages: PageChange[]; meta: Array<"title" | "profile" | "mode" | "language" | "themeId" | "options" | "params"> }

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const blocksOf = (c: Canvas): Map<string, { block: BlockInstance; pageId: string }> => new Map(c.pages.flatMap((p) => p.blocks.map((b) => [b.id, { block: b, pageId: p.id }] as const)));

export const changedFields = (a: BlockInstance, b: BlockInstance): BlockField[] => BLOCK_FIELDS.filter((f) => !same(a[f], b[f]));

const pageSettings = (p: CanvasPage): unknown => ({ format: p.format, mode: p.mode, size: p.size, background: p.background, themeId: p.themeId });

export function diffCanvases(before: Canvas, after: Canvas): CanvasDiff {
  const a = blocksOf(before), b = blocksOf(after);
  const blocks: BlockChange[] = [];
  for (const [id, x] of b) {
    const old = a.get(id);
    if (!old) { blocks.push({ blockId: id, pageId: x.pageId, change: "ADDED", fields: [] }); continue; }
    const fields = changedFields(old.block, x.block);
    // Moving a block to another page is a change of where it is, whatever else happened.
    if (fields.length > 0 || old.pageId !== x.pageId) blocks.push({ blockId: id, pageId: x.pageId, change: "CHANGED", fields: old.pageId !== x.pageId && !fields.includes("bounds") ? [...fields, "bounds"] : fields });
  }
  for (const [id, x] of a) if (!b.has(id)) blocks.push({ blockId: id, pageId: x.pageId, change: "REMOVED", fields: [] });

  const pages: PageChange[] = [];
  const beforePages = new Map(before.pages.map((p) => [p.id, p])), afterPages = new Map(after.pages.map((p) => [p.id, p]));
  for (const p of after.pages) {
    const old = beforePages.get(p.id);
    if (!old) pages.push({ pageId: p.id, change: "ADDED" });
    else {
      if (old.title !== p.title) pages.push({ pageId: p.id, change: "RENAMED" });
      if (!same(pageSettings(old), pageSettings(p))) pages.push({ pageId: p.id, change: "SETTINGS" });
    }
  }
  for (const p of before.pages) if (!afterPages.has(p.id)) pages.push({ pageId: p.id, change: "REMOVED" });
  const keptBefore = before.pages.filter((p) => afterPages.has(p.id)).map((p) => p.id), keptAfter = after.pages.filter((p) => beforePages.has(p.id)).map((p) => p.id);
  if (!same(keptBefore, keptAfter)) for (const id of keptAfter) pages.push({ pageId: id, change: "REORDERED" });

  const meta = (["title", "profile", "mode", "language", "themeId", "options", "params"] as const).filter((k) => !same(before[k], after[k]));
  return { blocks, pages, meta };
}

export const isEmptyDiff = (d: CanvasDiff): boolean => d.blocks.length === 0 && d.pages.length === 0 && d.meta.length === 0;

/** One plain sentence per change, for the history list ("Heading: text changed"). `nameOf` supplies the block's words. */
export function describeDiff(d: CanvasDiff, nameOf: (blockId: string) => string): string[] {
  const out: string[] = [];
  for (const c of d.blocks) out.push(c.change === "ADDED" ? `Added ${nameOf(c.blockId)}` : c.change === "REMOVED" ? `Removed ${nameOf(c.blockId)}` : `Changed ${nameOf(c.blockId)} (${c.fields.join(", ") || "page"})`);
  for (const p of d.pages) out.push(`Page ${p.change.toLowerCase()}: ${p.pageId}`);
  for (const m of d.meta) out.push(`Canvas ${m} changed`);
  return out;
}
