/**
 * Copy and paste between canvases (Phase 48.1). The clipboard carries block definitions only (kind, settings, size, bindings, the
 * way they sit to each other), never figures: a paste is drawn again from the records the person who pastes may see. A paste is
 * re-checked like any edit, so a block the product no longer knows, a full page or a project the person cannot reach is refused.
 */
import { CANVAS_MAX_BLOCKS_PER_PAGE, type BlockInstance, type Canvas, type CanvasBounds } from "../canvas.js";
import { definitionFor } from "../blocks/registry.js";
import { settleBlocks } from "./edit.js";
import { boundsOf, pageOf } from "./selection.js";

export const CLIPBOARD_VERSION = 1;

export interface ClipboardBlock { id: string; kind: string; props: unknown; bindings: BlockInstance["bindings"]; bounds: CanvasBounds; container?: BlockInstance["container"] | undefined; alt?: string | undefined; description?: string | undefined; style?: BlockInstance["style"] }
export interface ClipboardPayload { app: "donordesk-canvas"; version: typeof CLIPBOARD_VERSION; blocks: ClipboardBlock[] }

export type PasteResult = { ok: true; canvas: Canvas; pastedIds: string[] } | { ok: false; reason: string };

export function copyBlocks(c: Canvas, ids: readonly string[]): ClipboardPayload | null {
  const page = ids[0] ? pageOf(c, ids[0]) : undefined;
  if (!page) return null;
  // A selected container takes what it holds; a held block alone keeps no container link.
  const chosen = new Set(ids);
  const withHeld = page.blocks.filter((b) => chosen.has(b.id) || (b.container && chosen.has(b.container.id)));
  if (withHeld.length === 0) return null;
  const box = boundsOf(withHeld.filter((b) => !b.container)) ?? boundsOf(withHeld)!;
  const blocks = withHeld.map((b): ClipboardBlock => ({
    id: b.id, kind: b.kind, props: structuredClone(b.props), bindings: structuredClone(b.bindings),
    bounds: b.container ? { ...b.bounds } : { ...b.bounds, x: b.bounds.x - box.x, y: b.bounds.y - box.y },
    container: b.container && chosen.has(b.container.id) ? b.container : undefined, alt: b.alt, description: b.description, style: b.style ? { ...b.style, locked: false } : undefined,
  }));
  return { app: "donordesk-canvas", version: CLIPBOARD_VERSION, blocks };
}

/** Anything pasted from outside is untrusted: it must be a clipboard payload of this version with known kinds. */
export function readPayload(text: string): ClipboardPayload | string {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return "That is not something copied from a canvas."; }
  const p = parsed as Partial<ClipboardPayload> | null;
  if (!p || p.app !== "donordesk-canvas" || p.version !== CLIPBOARD_VERSION || !Array.isArray(p.blocks) || p.blocks.length === 0) return "That is not something copied from a canvas.";
  for (const b of p.blocks) if (!b || typeof b.id !== "string" || typeof b.kind !== "string" || !definitionFor(b.kind)) return "Part of what was copied is not a block this version knows.";
  return p as ClipboardPayload;
}

/** Pastes at the top-left of the free space below the page's content (or at `at`), with new ids made by `newId`. */
export function pasteBlocks(c: Canvas, pageId: string, payload: ClipboardPayload, newId: () => string, at?: { x: number; y: number }, canReachProject: (projectId: string) => boolean = () => true): PasteResult {
  const page = c.pages.find((p) => p.id === pageId);
  if (!page) return { ok: false, reason: "That page does not exist." };
  if (page.blocks.length + payload.blocks.length > CANVAS_MAX_BLOCKS_PER_PAGE) return { ok: false, reason: `A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.` };
  const projectIds = payload.blocks.flatMap((b) => b.bindings.flatMap((x) => ("projectId" in x && typeof x.projectId === "string" ? [x.projectId] : [])));
  if (projectIds.some((p) => !canReachProject(p))) return { ok: false, reason: "Part of what was copied reads a project you cannot see." };
  const idMap = new Map(payload.blocks.map((b) => [b.id, newId()]));
  if (new Set(idMap.values()).size !== idMap.size || [...idMap.values()].some((i) => c.pages.some((p) => p.blocks.some((b) => b.id === i)))) return { ok: false, reason: "Two blocks share an id." };
  const baseY = at?.y ?? page.blocks.reduce((m, b) => Math.max(m, b.bounds.y + b.bounds.h), 0);
  const baseX = at?.x ?? 0;
  const pasted: BlockInstance[] = payload.blocks.map((b) => ({
    id: idMap.get(b.id)!, kind: b.kind, props: structuredClone(b.props), bindings: structuredClone(b.bindings),
    bounds: b.container ? { ...b.bounds } : { ...b.bounds, x: Math.min(Math.max(0, b.bounds.x + baseX), Math.max(0, 12 - b.bounds.w)), y: b.bounds.y + baseY },
    container: b.container ? { ...b.container, id: idMap.get(b.container.id) ?? b.container.id } : undefined, alt: b.alt, description: b.description, style: b.style,
  }));
  const ids = pasted.map((b) => b.id);
  const blocks = settleBlocks([...page.blocks, ...pasted], ids.filter((i) => !pasted.find((b) => b.id === i)?.container));
  return { ok: true, canvas: { ...c, pages: c.pages.map((p) => (p.id === pageId ? { ...p, blocks } : p)) }, pastedIds: ids };
}
