/**
 * Motion and storytelling (Phase 48.15), as data. Animations are screen-only: a file, a print and a viewer who asks for reduced motion
 * always get the final state. Nothing here may hide a figure: a counter ends on the exact recorded figure, a race shows every period's
 * gaps as gaps and always names the period on screen, and a story step names a block and a parameter state, never a made-up number.
 */
import type { ParamValue } from "./params.js";

export type Picture = "TEXT" | "NUMBER" | "CHART_LINE" | "CHART_BAR" | "MAP" | "IMAGE" | "OTHER";
export const ANIMATIONS = ["NONE", "FADE", "RISE", "GROW", "COUNT_UP", "DRAW"] as const;
export type AnimationId = (typeof ANIMATIONS)[number];
export const EASINGS = ["LINEAR", "EASE_OUT", "EASE_IN_OUT"] as const;
export type Easing = (typeof EASINGS)[number];

export interface AnimationSpec { animation: AnimationId; durationMs: number; delayMs: number; easing: Easing }
export const MAX_DURATION_MS = 3000;
export const MAX_DELAY_MS = 5000;
export const DEFAULT_ANIMATION: AnimationSpec = { animation: "NONE", durationMs: 400, delayMs: 0, easing: "EASE_OUT" };

/** Which animations suit which kind of picture: COUNT_UP is for a single figure, DRAW for lines and areas, GROW for bars. */
export const ANIMATION_SUITS: Readonly<Record<AnimationId, readonly Picture[]>> = {
  NONE: ["TEXT", "NUMBER", "CHART_LINE", "CHART_BAR", "MAP", "IMAGE", "OTHER"],
  FADE: ["TEXT", "NUMBER", "CHART_LINE", "CHART_BAR", "MAP", "IMAGE", "OTHER"],
  RISE: ["TEXT", "NUMBER", "IMAGE"],
  GROW: ["CHART_BAR"],
  COUNT_UP: ["NUMBER"],
  DRAW: ["CHART_LINE"],
};

export function animationProblems(a: AnimationSpec, picture: Picture): string[] {
  const out: string[] = [];
  if (!(ANIMATIONS as readonly string[]).includes(a.animation)) return ["Unknown animation."];
  if (!(ANIMATION_SUITS[a.animation] as readonly string[]).includes(picture)) out.push("That animation does not suit this block.");
  if (!Number.isFinite(a.durationMs) || a.durationMs < 100 || a.durationMs > MAX_DURATION_MS) out.push(`An animation lasts between 100 and ${MAX_DURATION_MS} ms.`);
  if (!Number.isFinite(a.delayMs) || a.delayMs < 0 || a.delayMs > MAX_DELAY_MS) out.push(`A delay is at most ${MAX_DELAY_MS} ms.`);
  if (!(EASINGS as readonly string[]).includes(a.easing)) out.push("Unknown easing.");
  return out;
}

/** Whether the screen may animate at all: never for reduced motion, a file, print or a person who switched it off. */
export const mayAnimate = (o: { prefersReducedMotion: boolean; viewerDisabled: boolean; forFile: boolean }): boolean => !o.prefersReducedMotion && !o.viewerDisabled && !o.forFile;

const ease = (t: number, e: Easing): number => (e === "LINEAR" ? t : e === "EASE_OUT" ? 1 - (1 - t) ** 3 : t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The figure shown at time `elapsed` of a count-up. It always ends on exactly `target` (no rounding drift), and a gap never animates. */
export function counterAt(target: number | null, elapsedMs: number, spec: Pick<AnimationSpec, "durationMs" | "delayMs" | "easing">, decimals = 0): number | null {
  if (target === null) return null;
  const t = Math.min(1, Math.max(0, (elapsedMs - spec.delayMs) / spec.durationMs));
  if (t >= 1) return target;
  const f = 10 ** decimals;
  return Math.round(target * ease(t, spec.easing) * f) / f;
}

export interface RaceFrame { periodId: string; label: string; entries: Array<{ id: string; label: string; value: number | null; rank: number | null }> }

/**
 * Frames of a bar race over recorded periods. Each frame ranks the items that have a value in that period (highest first, ties by name);
 * an item with nothing recorded is listed with a null value and no rank, so a gap is a gap and never a bar of 0. The period label is on
 * every frame so the viewer always knows which period they are looking at.
 */
export function raceFrames(periods: ReadonlyArray<{ id: string; label: string }>, items: ReadonlyArray<{ id: string; label: string }>, valueAt: (itemId: string, periodId: string) => number | null): RaceFrame[] {
  return periods.map((p) => {
    const raw = items.map((i) => ({ id: i.id, label: i.label, value: valueAt(i.id, p.id) }));
    const ranked = raw.filter((r) => r.value !== null).sort((a, b) => (b.value as number) - (a.value as number) || a.label.localeCompare(b.label));
    const rankOf = new Map(ranked.map((r, i) => [r.id, i + 1]));
    return { periodId: p.id, label: p.label, entries: raw.map((r) => ({ ...r, rank: rankOf.get(r.id) ?? null })).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.label.localeCompare(b.label)) };
  });
}

/** One step of a story: a page, a block to highlight, the parameter state to show and the author's own caption. */
export interface StoryStep { id: string; pageId: string; highlightBlockId?: string | undefined; params?: Record<string, ParamValue> | undefined; caption: string }
export const MAX_STORY_STEPS = 30;
export const MAX_CAPTION = 400;

export function storyProblems(steps: ReadonlyArray<StoryStep>, canvas: { pageIds: ReadonlySet<string>; blockPage: ReadonlyMap<string, string>; paramIds: ReadonlySet<string> }): string[] {
  const out: string[] = [];
  if (steps.length > MAX_STORY_STEPS) out.push(`A story has at most ${MAX_STORY_STEPS} steps.`);
  const ids = new Set<string>();
  steps.forEach((s, i) => {
    const at = `Step ${i + 1}`;
    if (ids.has(s.id)) out.push(`${at} shares an id with another step.`);
    ids.add(s.id);
    if (!canvas.pageIds.has(s.pageId)) out.push(`${at} shows a page that does not exist.`);
    if (s.highlightBlockId && canvas.blockPage.get(s.highlightBlockId) !== s.pageId) out.push(`${at} highlights a block that is not on its page.`);
    for (const p of Object.keys(s.params ?? {})) if (!canvas.paramIds.has(p)) out.push(`${at} sets a parameter that does not exist (${p}).`);
    if (s.caption.length > MAX_CAPTION) out.push(`${at}'s caption is at most ${MAX_CAPTION} characters.`);
  });
  return out;
}

/** The step to show for a key press or a scroll position; stays inside the story. */
export const stepIndex = (current: number, total: number, move: "NEXT" | "PREVIOUS" | "FIRST" | "LAST"): number => (total <= 0 ? 0 : move === "FIRST" ? 0 : move === "LAST" ? total - 1 : Math.min(total - 1, Math.max(0, current + (move === "NEXT" ? 1 : -1))));
