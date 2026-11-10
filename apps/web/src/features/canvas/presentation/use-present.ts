"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/** The page after or before `current` in reading order, or the same page at either end. Pure, so the keys can be tested without a browser. */
export function neighbourPage(ids: readonly string[], current: string, step: 1 | -1): string {
  const at = ids.indexOf(current);
  if (at < 0) return ids[0] ?? current;
  return ids[Math.min(ids.length - 1, Math.max(0, at + step))] ?? current;
}

/**
 * Present mode (Phase 48.9): the page fills the screen using the browser's own fullscreen; the arrow keys, Page Up and Page Down and the space bar
 * move between pages, and Escape leaves it (the browser does that itself). Nothing is animated here: a viewer who asked for reduced motion
 * gets exactly what everyone gets. A browser with no fullscreen simply has no Present button.
 */
export function usePresent(stage: RefObject<HTMLElement | null>, pageIds: readonly string[], current: string, goTo: (id: string) => void) {
  const [presenting, setPresenting] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => { setAvailable(typeof document !== "undefined" && document.fullscreenEnabled === true); }, []);

  useEffect(() => {
    const change = () => setPresenting(document.fullscreenElement !== null && document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, [stage]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      const forward = e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ";
      const back = e.key === "ArrowLeft" || e.key === "PageUp";
      if (!forward && !back) return;
      e.preventDefault();
      goTo(neighbourPage(pageIds, current, forward ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, pageIds, current, goTo]);

  const start = useCallback(() => { void stage.current?.requestFullscreen?.().catch(() => undefined); }, [stage]);
  return { presenting, available, start };
}
