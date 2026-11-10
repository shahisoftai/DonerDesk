"use client";

import { ANIMATIONS, ANIMATION_SUITS, DEFAULT_ANIMATION, EASINGS, MAX_DELAY_MS, MAX_DURATION_MS, pictureOfBlock, type AnimationId, type AnimationSpec, type BlockInstance } from "@donordesk/domain/contexts/canvas/index.js";

const WORDS: Readonly<Record<AnimationId, string>> = { NONE: "None", FADE: "Fade in", RISE: "Rise in", GROW: "Bars grow", COUNT_UP: "Count up", DRAW: "Line draws" };
const EASING_WORDS = { LINEAR: "Steady", EASE_OUT: "Slow at the end", EASE_IN_OUT: "Slow at both ends" } as const;
const FIELD = "w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900";

/**
 * How the selected block comes in on a screen. Only the animations that suit its picture are offered (a counter for a figure, a draw for a
 * line, a growth for bars). It never applies to a file or a print, and a viewer who asked for reduced motion sees the final picture.
 */
export function MotionControl({ block, disabled, onMotion }: { block: BlockInstance; disabled: boolean; onMotion: (motion: AnimationSpec | undefined) => void }) {
  const suited = ANIMATIONS.filter((a) => (ANIMATION_SUITS[a] as readonly string[]).includes(pictureOfBlock(block)));
  const current = block.motion ?? DEFAULT_ANIMATION;
  const set = (change: Partial<AnimationSpec>) => { const next = { ...current, ...change }; onMotion(next.animation === "NONE" ? undefined : next); };
  return (
    <fieldset className="space-y-2" data-testid="motion-control" disabled={disabled}>
      <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">Motion</legend>
      <label className="block space-y-1 text-xs"><span>How it comes in</span>
        <select className={FIELD} value={current.animation} onChange={(e) => set({ animation: e.target.value as AnimationId })}>{suited.map((a) => <option key={a} value={a}>{WORDS[a]}</option>)}</select></label>
      {current.animation !== "NONE" && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="space-y-1"><span>Takes (ms)</span><input type="number" min={100} max={MAX_DURATION_MS} step={100} className={FIELD} value={current.durationMs} onChange={(e) => set({ durationMs: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span>Waits (ms)</span><input type="number" min={0} max={MAX_DELAY_MS} step={100} className={FIELD} value={current.delayMs} onChange={(e) => set({ delayMs: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span>Pace</span><select className={FIELD} value={current.easing} onChange={(e) => set({ easing: e.target.value as AnimationSpec["easing"] })}>{EASINGS.map((x) => <option key={x} value={x}>{EASING_WORDS[x]}</option>)}</select></label>
        </div>
      )}
      <p className="text-xs text-slate-500">Shown on a screen only. A file, a print and a viewer who asked for reduced motion get the final picture.</p>
    </fieldset>
  );
}
