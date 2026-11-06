"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LOW_DATA_STORAGE_KEY, isLowData, parseLowDataChoice, type LowDataChoice } from "../domain/low-data.ts";

const EVENT = "dd:low-data-changed";

const read = (): LowDataChoice => {
  try { return parseLowDataChoice(window.localStorage.getItem(LOW_DATA_STORAGE_KEY)); } catch { return null; }
};
const asksForLess = (): boolean => {
  try { return window.matchMedia?.("(prefers-reduced-data: reduce)").matches === true; } catch { return false; }
};
const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", notify); };
};
const snapshot = (): string => `${read() ?? ""}|${asksForLess() ? "1" : "0"}`;

/** Whether charts are shown as tables, and the way to change it. The choice is kept on this device only (storage may be refused; the page still works). */
export function useLowData(): { lowData: boolean; set: (on: boolean) => void } {
  const s = useSyncExternalStore(subscribe, snapshot, () => "|0");
  const [choice, ask] = s.split("|");
  const set = useCallback((on: boolean) => {
    try { window.localStorage.setItem(LOW_DATA_STORAGE_KEY, on ? "on" : "off"); } catch { /* the choice is simply not kept */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { lowData: isLowData(parseLowDataChoice(choice), ask === "1"), set };
}
