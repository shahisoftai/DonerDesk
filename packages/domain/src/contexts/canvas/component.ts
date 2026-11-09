/**
 * Saved components (Phase 48.2): a group of blocks kept in a library and used again. An instance is a set of ordinary blocks tagged with
 * the component, its version and which of the component's blocks each one is. Updating the component updates its instances except for the
 * settings a slot lets an instance keep for itself; detaching an instance makes the blocks ordinary. Pure, like `edit/`.
 */
import { CANVAS_MAX_BLOCKS_PER_PAGE, type BlockInstance, type Canvas } from "./canvas.js";
import { copyBlocks, pasteBlocks, type ClipboardBlock } from "./edit/clipboard.js";
import { definitionFor } from "./blocks/registry.js";
import { pageOf } from "./edit/selection.js";
import { getAt, setAt } from "./props-path.js";

export const COMPONENT_SCOPES = ["ORG", "PROJECT", "MINE"] as const;
export type ComponentScope = (typeof COMPONENT_SCOPES)[number];
export const MAX_COMPONENT_BLOCKS = 30;

/** A setting an instance may change without losing the link: a path into one block's settings. */
export interface ComponentSlot { id: string; label: string; blockKey: string; path: string }

export interface CanvasComponent {
  id: string;
  name: string;
  description?: string | undefined;
  scope: ComponentScope;
  revision: number;
  blocks: ClipboardBlock[];
  slots: ComponentSlot[];
}

export const componentProblems = (c: CanvasComponent): string[] => {
  const out: string[] = [];
  if (!c.name.trim() || c.name.length > 80) out.push("A component's name is 1 to 80 characters.");
  if (c.blocks.length === 0) out.push("A component holds at least one block.");
  if (c.blocks.length > MAX_COMPONENT_BLOCKS) out.push(`A component holds at most ${MAX_COMPONENT_BLOCKS} blocks.`);
  const keys = new Set(c.blocks.map((b) => b.id));
  if (keys.size !== c.blocks.length) out.push("Two blocks of the component share a key.");
  for (const b of c.blocks) if (!definitionFor(b.kind)) out.push(`The component holds a block the product does not know (${b.kind}).`);
  for (const b of c.blocks) if (b.container && !keys.has(b.container.id)) out.push("A block sits in a container that is not part of the component.");
  const slotIds = new Set<string>();
  for (const s of c.slots) {
    if (slotIds.has(s.id)) out.push("Two slots share an id.");
    slotIds.add(s.id);
    if (!keys.has(s.blockKey)) out.push(`The slot "${s.label}" points at a block that is not in the component.`);
    if (!s.path.trim()) out.push(`The slot "${s.label}" needs a setting to point at.`);
  }
  return out;
};

export type ComponentResult = { ok: true; component: CanvasComponent } | { ok: false; reason: string };

/** Makes a component from selected blocks; their positions become relative to each other. A new component starts at revision 1. */
export function componentFromBlocks(c: Canvas, ids: readonly string[], input: { id: string; name: string; scope: ComponentScope; description?: string }): ComponentResult {
  const payload = copyBlocks(c, ids);
  if (!payload) return { ok: false, reason: "Select the blocks to keep." };
  const component: CanvasComponent = { id: input.id, name: input.name.trim(), description: input.description, scope: input.scope, revision: 1, blocks: payload.blocks.map((b) => ({ ...b, style: b.style ? { ...b.style, locked: false } : undefined })), slots: [] };
  const problems = componentProblems(component);
  return problems.length > 0 ? { ok: false, reason: problems[0]! } : { ok: true, component };
}

export const addSlot = (comp: CanvasComponent, slot: ComponentSlot): ComponentResult => {
  const next = { ...comp, slots: [...comp.slots.filter((s) => s.id !== slot.id), slot] };
  const problems = componentProblems(next);
  return problems.length > 0 ? { ok: false, reason: problems[0]! } : { ok: true, component: next };
};

/** A new revision with changed blocks; instances catch up through `updateInstances`. */
export function reviseComponent(comp: CanvasComponent, blocks: ClipboardBlock[], slots = comp.slots): ComponentResult {
  const next = { ...comp, blocks, slots, revision: comp.revision + 1 };
  const problems = componentProblems(next);
  return problems.length > 0 ? { ok: false, reason: problems[0]! } : { ok: true, component: next };
}

export type InstantiateResult = { ok: true; canvas: Canvas; blockIds: string[] } | { ok: false; reason: string };

/** Puts a component on a page; every block is tagged so it can be updated or detached later. */
export function instantiate(c: Canvas, pageId: string, comp: CanvasComponent, newId: () => string, at?: { x: number; y: number }): InstantiateResult {
  const problems = componentProblems(comp);
  if (problems.length > 0) return { ok: false, reason: problems[0]! };
  const page = c.pages.find((p) => p.id === pageId);
  if (!page) return { ok: false, reason: "That page does not exist." };
  if (page.blocks.length + comp.blocks.length > CANVAS_MAX_BLOCKS_PER_PAGE) return { ok: false, reason: `A page holds at most ${CANVAS_MAX_BLOCKS_PER_PAGE} blocks.` };
  const r = pasteBlocks(c, pageId, { app: "donordesk-canvas", version: 1, blocks: comp.blocks }, newId, at);
  if (!r.ok) return r;
  // pasteBlocks gives new ids in the component's block order, so the Nth pasted block is the Nth component block.
  const tagged = new Map(r.pastedIds.map((id, i) => [id, comp.blocks[i]!.id]));
  const next: Canvas = { ...c, pages: r.canvas.pages.map((p) => (p.id === pageId ? { ...p, blocks: p.blocks.map((b) => (tagged.has(b.id) ? { ...b, component: { id: comp.id, version: comp.revision, key: tagged.get(b.id)! } } : b)) } : p)) };
  return { ok: true, canvas: next, blockIds: r.pastedIds };
}

/** Makes an instance's blocks ordinary again. Selecting any block of an instance detaches the whole instance on that page. */
export function detach(c: Canvas, ids: readonly string[]): { ok: true; canvas: Canvas } | { ok: false; reason: string } {
  const page = ids[0] ? pageOf(c, ids[0]) : undefined;
  if (!page) return { ok: false, reason: "That block does not exist." };
  const linked = ids.map((i) => page.blocks.find((b) => b.id === i)?.component).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (linked.length === 0) return { ok: false, reason: "That is not part of a component." };
  const target = new Set(linked.map((l) => `${l.id}@${l.version}`));
  return { ok: true, canvas: { ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks: p.blocks.map((b) => (b.component && target.has(`${b.component.id}@${b.component.version}`) ? { ...b, component: undefined } : b)) } : p)) } };
}

export interface UpdateReport { canvas: Canvas; updated: number; notInComponent: string[]; missingFromInstance: string[] }

/**
 * Brings every instance of a component up to its current revision: the block's kind and settings follow the component, its place,
 * size, alt text and the values of the component's slots stay the instance's own. A block whose key is gone from the component is
 * left as it is and reported; a component block that has no instance block is reported, not added behind the person's back.
 */
export function updateInstances(c: Canvas, comp: CanvasComponent): UpdateReport {
  const byKey = new Map(comp.blocks.map((b) => [b.id, b]));
  let updated = 0;
  const notInComponent: string[] = [];
  const seen = new Set<string>();
  const pages = c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b): BlockInstance => {
    if (b.component?.id !== comp.id || b.component.version === comp.revision) return b;
    const source = byKey.get(b.component.key);
    if (!source) { notInComponent.push(b.id); return b; }
    seen.add(`${b.component.version}:${b.component.key}`);
    let props = structuredClone(source.props);
    for (const slot of comp.slots.filter((s) => s.blockKey === b.component!.key)) {
      const mine = getAt(b.props, slot.path);
      if (mine !== undefined) props = setAt(props, slot.path, mine);
    }
    updated += 1;
    return { ...b, kind: source.kind, props, bindings: b.bindings.length > 0 ? b.bindings : structuredClone(source.bindings), component: { ...b.component, version: comp.revision } };
  }) }));
  const present = new Set(pages.flatMap((p) => p.blocks).filter((b) => b.component?.id === comp.id).map((b) => b.component!.key));
  const missingFromInstance = comp.blocks.filter((b) => present.size > 0 && !present.has(b.id)).map((b) => b.id);
  return { canvas: { ...c, pages }, updated, notInComponent, missingFromInstance };
}
