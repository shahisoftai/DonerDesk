/**
 * Merging two people's edits (Phase 48.6): a three-way merge of canvases by block id. `base` is the document both started from, `mine` is
 * the current one (usually the server's) and `theirs` is the one being added (a stale save or a suggestion). Blocks changed in only one
 * place merge on their own; the same field of the same block changed two different ways is a conflict, which is returned, never
 * resolved silently. The result always keeps everything: a block removed in one and changed in the other is a conflict too.
 */
import type { BlockInstance, Canvas, CanvasPage } from "./canvas.js";
import { changedFields, type BlockField } from "./diff.js";

export interface BlockConflict { blockId: string; kind: "FIELD" | "REMOVED_VS_CHANGED"; fields: BlockField[] }
export interface MergeResult { canvas: Canvas; conflicts: BlockConflict[]; /** Blocks taken from `theirs` (added or changed) without conflict. */ taken: string[] }

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const index = (c: Canvas): Map<string, { block: BlockInstance; pageId: string }> => new Map(c.pages.flatMap((p) => p.blocks.map((b) => [b.id, { block: b, pageId: p.id }] as const)));

export function mergeCanvases(base: Canvas, mine: Canvas, theirs: Canvas): MergeResult {
  const baseIx = index(base), mineIx = index(mine), theirIx = index(theirs);
  const conflicts: BlockConflict[] = [];
  const taken: string[] = [];
  const out = new Map<string, { block: BlockInstance; pageId: string } | null>();

  for (const [id, m] of mineIx) out.set(id, m);
  for (const [id, t] of theirIx) {
    const b = baseIx.get(id), m = mineIx.get(id);
    if (!b) { if (!m) { out.set(id, t); taken.push(id); } else if (changedFields(m.block, t.block).length > 0) conflicts.push({ blockId: id, kind: "FIELD", fields: changedFields(m.block, t.block) }); continue; }
    const theirChanged = changedFields(b.block, t.block);
    if (theirChanged.length === 0 && b.pageId === t.pageId) continue;
    if (!m) { conflicts.push({ blockId: id, kind: "REMOVED_VS_CHANGED", fields: theirChanged }); continue; }
    const mineChanged = changedFields(b.block, m.block);
    const clash = theirChanged.filter((f) => mineChanged.includes(f) && !same(m.block[f], t.block[f]));
    if (clash.length > 0) { conflicts.push({ blockId: id, kind: "FIELD", fields: clash }); continue; }
    const merged: BlockInstance = { ...m.block };
    for (const f of theirChanged) (merged as unknown as Record<string, unknown>)[f] = t.block[f];
    out.set(id, { block: merged, pageId: b.pageId === t.pageId ? m.pageId : t.pageId });
    taken.push(id);
  }
  for (const [id, b] of baseIx) {
    if (theirIx.has(id)) continue;
    const m = mineIx.get(id);
    if (!m) continue;
    // Theirs removed it: fine when mine left it alone, a conflict when mine changed it.
    if (changedFields(b.block, m.block).length > 0) conflicts.push({ blockId: id, kind: "REMOVED_VS_CHANGED", fields: changedFields(b.block, m.block) });
    else { out.delete(id); taken.push(id); }
  }

  // Pages: mine's order and settings, plus pages only theirs added; blocks go to the page the merge chose.
  const pageIds = [...mine.pages.map((p) => p.id), ...theirs.pages.filter((p) => !mine.pages.some((q) => q.id === p.id) && !base.pages.some((q) => q.id === p.id)).map((p) => p.id)];
  const pageOf = (id: string): CanvasPage => mine.pages.find((p) => p.id === id) ?? theirs.pages.find((p) => p.id === id)!;
  const pages = pageIds.map((id) => ({ ...pageOf(id), blocks: [...out].filter(([, v]) => v && v.pageId === id).map(([, v]) => v!.block) }));
  // A block whose page no longer exists stays on the first page, never lost.
  const orphans = [...out].filter(([, v]) => v && !pageIds.includes(v.pageId)).map(([, v]) => v!.block);
  if (orphans.length > 0 && pages[0]) pages[0] = { ...pages[0], blocks: [...pages[0].blocks, ...orphans] };

  const canvas: Canvas = { ...mine, pages };
  for (const key of ["title", "profile", "mode", "language", "themeId", "options", "params"] as const) {
    if (!same(base[key], theirs[key]) && same(base[key], mine[key])) (canvas as unknown as Record<string, unknown>)[key] = theirs[key];
  }
  return { canvas, conflicts, taken };
}

/** Takes `theirs` for the named blocks of a conflict (the person chose to) and returns the merged canvas. */
export function resolveConflicts(merged: Canvas, theirs: Canvas, choices: Readonly<Record<string, "MINE" | "THEIRS">>): Canvas {
  const theirIx = index(theirs);
  const pages = merged.pages.map((p) => ({ ...p, blocks: p.blocks.flatMap((b) => {
    if (choices[b.id] !== "THEIRS") return [b];
    const t = theirIx.get(b.id);
    return t ? [t.block] : [];
  }) }));
  const have = new Set(pages.flatMap((p) => p.blocks.map((b) => b.id)));
  const extra = Object.entries(choices).filter(([id, c]) => c === "THEIRS" && !have.has(id) && theirIx.has(id)).map(([id]) => theirIx.get(id)!);
  if (extra.length > 0 && pages[0]) pages[0] = { ...pages[0], blocks: [...pages[0].blocks, ...extra.map((e) => e.block)] };
  return { ...merged, pages };
}

