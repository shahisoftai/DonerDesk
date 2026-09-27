"use client";

import { useEffect, useState } from "react";

/**
 * Whether a CSS media query matches, following changes. `defaultValue` is
 * used for the server render and the first client render (no mismatch).
 */
export function useMediaQuery(query: string, defaultValue: boolean): boolean {
  const [matches, setMatches] = useState(defaultValue);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}
