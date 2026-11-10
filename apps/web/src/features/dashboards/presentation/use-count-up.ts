"use client";

import { useEffect, useState } from "react";
import { counterAt, type AnimationSpec } from "@donordesk/domain/contexts/canvas/index.js";

const decimalsOf = (n: number): number => { const s = String(n); const at = s.indexOf("."); return at < 0 ? 0 : Math.min(4, s.length - at - 1); };

/**
 * The figure a count-up tile shows right now. It ends on exactly `target` (never a rounded neighbour), a gap never counts, and with no
 * motion asked for, or a viewer who asked for reduced motion, it is the target from the first paint.
 */
export function useCountUp(target: number | null, spec: AnimationSpec | undefined): number | null {
  const [shown, setShown] = useState<number | null>(target);
  useEffect(() => {
    if (!spec || spec.animation !== "COUNT_UP" || target === null || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) { setShown(target); return; }
    const decimals = decimalsOf(target);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setShown(counterAt(target, now - started, spec, decimals));
      if (now - started < spec.delayMs + spec.durationMs) frame = requestAnimationFrame(tick);
    };
    setShown(counterAt(target, 0, spec, decimals));
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, spec?.animation, spec?.durationMs, spec?.delayMs, spec?.easing]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}
