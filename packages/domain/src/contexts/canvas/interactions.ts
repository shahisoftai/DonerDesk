/**
 * How one block reacts when a person clicks in another (Phase 50.4, Power BI's "edit interactions"). The default is FILTER, as the
 * canvas has always done; an author may make a block HIGHLIGHT instead (it keeps every point and dims the ones outside the choice) or
 * ignore that block (NONE). Maps, line charts and timelines cannot highlight: dimming an area or a line point says nothing true about
 * the rest, so for them the choice is FILTER or NONE. Pure.
 */
import type { Canvas } from "./canvas.js";
import { definitionFor } from "./blocks/registry.js";

export const INTERACTION_EFFECTS = ["FILTER", "HIGHLIGHT", "NONE"] as const;
export type InteractionEffect = (typeof INTERACTION_EFFECTS)[number];
/** source block id -> target block id -> effect; only the exceptions to FILTER are stored. */
export type CanvasInteractions = Record<string, Record<string, InteractionEffect>>;

/** Whether a block can dim instead of narrowing: it says so itself (`highlightable`); a block that does not say cannot. */
export function canHighlight(kind: string, props: unknown): boolean {
  const def = definitionFor(kind) as unknown as { highlightable?: boolean | ((p: unknown) => boolean) } | undefined;
  const h = def?.highlightable;
  return typeof h === "function" ? h(props) : h === true;
}

export function effectOf(canvas: Pick<Canvas, "interactions">, sourceId: string, targetId: string): InteractionEffect {
  if (sourceId === targetId) return "NONE";
  return canvas.interactions?.[sourceId]?.[targetId] ?? "FILTER";
}

/** Sets one pair; FILTER removes the exception so a default canvas stores nothing. Returns null when the target cannot take the effect. */
export function setInteraction(canvas: Canvas, sourceId: string, targetId: string, effect: InteractionEffect): Canvas | null {
  if (sourceId === targetId || !INTERACTION_EFFECTS.includes(effect)) return null;
  const target = canvas.pages.flatMap((p) => p.blocks).find((b) => b.id === targetId);
  if (!target || (effect === "HIGHLIGHT" && !canHighlight(target.kind, target.props))) return null;
  const all: CanvasInteractions = { ...(canvas.interactions ?? {}) };
  const row = { ...(all[sourceId] ?? {}) };
  if (effect === "FILTER") delete row[targetId]; else row[targetId] = effect;
  if (Object.keys(row).length === 0) delete all[sourceId]; else all[sourceId] = row;
  return { ...canvas, interactions: Object.keys(all).length ? all : undefined };
}

/** Problems with stored interactions: unknown blocks, unknown effects, a highlight a block cannot draw. Removing a block leaves its rows behind; `pruneInteractions` cleans them. */
export function interactionProblems(canvas: Canvas): string[] {
  const blocks = new Map(canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, b] as const));
  const out: string[] = [];
  for (const [src, row] of Object.entries(canvas.interactions ?? {})) for (const [tgt, eff] of Object.entries(row)) {
    if (!INTERACTION_EFFECTS.includes(eff)) out.push("Unknown interaction.");
    else if (eff === "HIGHLIGHT") { const b = blocks.get(tgt); if (b && !canHighlight(b.kind, b.props)) out.push("That block cannot highlight; choose Filter or None."); }
    if (src === tgt) out.push("A block does not react to itself.");
  }
  return [...new Set(out)];
}

export function pruneInteractions(canvas: Canvas): Canvas {
  if (!canvas.interactions) return canvas;
  const ids = new Set(canvas.pages.flatMap((p) => p.blocks.map((b) => b.id)));
  const next: CanvasInteractions = {};
  for (const [src, row] of Object.entries(canvas.interactions)) {
    if (!ids.has(src)) continue;
    const kept = Object.fromEntries(Object.entries(row).filter(([t]) => ids.has(t)));
    if (Object.keys(kept).length) next[src] = kept;
  }
  return { ...canvas, interactions: Object.keys(next).length ? next : undefined };
}

/** Which targets a click in `sourceId` filters and which it highlights: the screen applies FILTER through a re-read and HIGHLIGHT locally. */
export function splitTargets(canvas: Canvas, sourceId: string): { filter: string[]; highlight: string[] } {
  const filter: string[] = [], highlight: string[] = [];
  for (const b of canvas.pages.flatMap((p) => p.blocks)) {
    const e = effectOf(canvas, sourceId, b.id);
    if (e === "FILTER") filter.push(b.id); else if (e === "HIGHLIGHT") highlight.push(b.id);
  }
  return { filter, highlight };
}
