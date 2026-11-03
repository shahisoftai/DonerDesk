"use client";

import { useSyncExternalStore } from "react";
import type { ThemeMode } from "../domain/tokens.ts";

const subscribe = (notify: () => void): (() => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const snapshot = (): ThemeMode => (document.documentElement.classList.contains("dark") ? "dark" : "light");

/** The colour mode the page is showing now (the `dark` class on the page), following the theme toggle and the system setting. */
export function useColorMode(): ThemeMode {
  return useSyncExternalStore(subscribe, snapshot, () => "light");
}
