"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultDrawerPrefs, parseDrawerPrefs, type DrawerPrefs } from "../domain/drawer-state";

const KEY = "dd-canvas-drawers";

/** The drawers' settings for this person on this device. Storage can fail (private window): the drawers then use the defaults. */
export function useDrawerPrefs(): [DrawerPrefs, (change: Partial<DrawerPrefs>) => void] {
  const [prefs, setPrefs] = useState<DrawerPrefs>(() => defaultDrawerPrefs(1440));
  useEffect(() => {
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked: defaults */ }
    setPrefs(parseDrawerPrefs(raw, window.innerWidth));
  }, []);
  const update = useCallback((change: Partial<DrawerPrefs>) => setPrefs((p) => {
    const next = { ...p, ...change };
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not kept; still works */ }
    return next;
  }), []);
  return [prefs, update];
}
