/**
 * Low-data mode (Phase 39.10): for a slow or expensive connection a dashboard shows each chart as its table of values (small, readable, nothing
 * lost) instead of drawing the picture, and does not load the chart library. On by the person's own choice, or by the browser's own
 * "reduce data" request when the person has not chosen. Pure: what was stored and what the browser asked go in; the answer comes out.
 */
export const LOW_DATA_STORAGE_KEY = "dd-low-data";
export type LowDataChoice = "on" | "off" | null;

export const parseLowDataChoice = (stored: string | null | undefined): LowDataChoice => (stored === "on" || stored === "off" ? stored : null);

/** The person's choice wins; with none, the browser's request decides. */
export const isLowData = (choice: LowDataChoice, browserAsksForLessData: boolean): boolean => (choice === null ? browserAsksForLessData : choice === "on");
