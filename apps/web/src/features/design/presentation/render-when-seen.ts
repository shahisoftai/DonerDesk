"use client";

import { useEffect, useState, type RefObject } from "react";

/** Asks every chart that has not drawn yet to draw now (before a picture of the dashboard is taken, or before printing). */
export const RENDER_ALL_EVENT = "dd:render-all-charts";
const SETTLE_MS = 700;

export function renderAllCharts(): Promise<void> {
  window.dispatchEvent(new Event(RENDER_ALL_EVENT));
  return new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS));
}

/**
 * True once the element has been near the screen (and stays true), or when it is asked to draw (printing, a picture of the page), or when the
 * browser cannot tell. A chart far down a long dashboard therefore costs nothing until the person scrolls to it.
 */
export function useRenderWhenSeen(ref: RefObject<Element | null>, enabled = true): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!enabled || seen) return;
    const now = () => setSeen(true);
    window.addEventListener(RENDER_ALL_EVENT, now);
    window.addEventListener("beforeprint", now);
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined" || !ref.current) now();
    else {
      observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) now(); }, { rootMargin: "300px" });
      observer.observe(ref.current);
    }
    return () => { window.removeEventListener(RENDER_ALL_EVENT, now); window.removeEventListener("beforeprint", now); observer?.disconnect(); };
  }, [ref, enabled, seen]);
  return seen;
}
