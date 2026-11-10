import type { AnimationSpec } from "@donordesk/domain/contexts/canvas/index.js";

const CSS_EASING = { LINEAR: "linear", EASE_OUT: "ease-out", EASE_IN_OUT: "ease-in-out" } as const;
const CHART_EASING = { LINEAR: "linear", EASE_OUT: "cubicOut", EASE_IN_OUT: "cubicInOut" } as const;

/** The CSS of an entrance (fade or rise); other animations are not CSS. The keyframes themselves are in the global stylesheet. */
export function motionStyle(motion: AnimationSpec | undefined): Record<string, string> | undefined {
  if (!motion || (motion.animation !== "FADE" && motion.animation !== "RISE")) return undefined;
  return { animationName: motion.animation === "FADE" ? "dd-fade" : "dd-rise", animationDuration: `${motion.durationMs}ms`, animationDelay: `${motion.delayMs}ms`, animationTimingFunction: CSS_EASING[motion.easing], animationFillMode: "both" };
}

/**
 * A chart's own animation (bars growing, a line drawing) on its first draw: the duration, delay and pace the person chose. Returns a new
 * option; one with no chart motion is returned as it is. Reduced motion is applied by the chart itself, which turns animation off.
 */
export function motionChartOption(option: Record<string, unknown>, motion: AnimationSpec | undefined): Record<string, unknown> {
  if (!motion || (motion.animation !== "GROW" && motion.animation !== "DRAW")) return option;
  return { ...option, animation: true, animationDuration: motion.durationMs, animationDelay: motion.delayMs, animationEasing: CHART_EASING[motion.easing] };
}
