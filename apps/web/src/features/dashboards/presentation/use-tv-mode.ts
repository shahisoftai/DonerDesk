"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full screen for a wall display: the dashboard fills the screen and asks the page to refresh every `seconds` so the figures stay current.
 * Leaving full screen by Escape is noticed. Where the browser refuses full screen the dashboard is still enlarged and refreshes.
 */
export function useTvMode(seconds: number, refresh: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const toggle = useCallback(() => {
    setActive((on) => {
      const next = !on;
      try {
        if (next) void ref.current?.requestFullscreen?.();
        else if (document.fullscreenElement) void document.exitFullscreen();
      } catch { /* the enlarged view still works */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => refreshRef.current(), seconds * 1000);
    const onChange = () => { if (!document.fullscreenElement) setActive(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => { window.clearInterval(timer); document.removeEventListener("fullscreenchange", onChange); };
  }, [active, seconds]);

  return { ref, active, toggle };
}
