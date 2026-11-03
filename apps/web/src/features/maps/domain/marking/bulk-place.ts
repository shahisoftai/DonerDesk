/**
 * Walking through the locations nobody has placed yet, one at a time. Pure.
 * Each is pinned or skipped; nothing is saved until the end, and the saving is the ordinary places sheet, so every rule of the import
 * applies (any bad row blocks the whole sheet and names its row; a place already listed is skipped, never duplicated).
 */
import type { Pin } from "./pin.ts";

export type WalkStatus = "PENDING" | "PLACED" | "SKIPPED";

export interface WalkItem {
  /** The words people typed for this location. */
  text: string;
  status: WalkStatus;
  pin?: Pin;
  /** 0 country ... 4 community or site. A location nobody has classified is most often a site. */
  level: number;
  /** The listed place it sits inside (a suggestion the person accepted), by name; empty for none. */
  parentName?: string;
}

export interface Walk { items: readonly WalkItem[]; current: number }

export const DEFAULT_WALK_LEVEL = 4;

export function startWalk(texts: readonly string[]): Walk {
  const seen = new Set<string>();
  const items: WalkItem[] = [];
  for (const raw of texts) {
    const text = raw.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    items.push({ text, status: "PENDING", level: DEFAULT_WALK_LEVEL });
  }
  return { items, current: 0 };
}

const replaceAt = (walk: Walk, index: number, item: WalkItem): Walk => ({ ...walk, items: walk.items.map((x, i) => (i === index ? item : x)) });
/** The next item still waiting after `from`, wrapping once; the current index when nothing waits. */
const nextPending = (items: readonly WalkItem[], from: number): number => {
  for (let step = 1; step <= items.length; step += 1) { const i = (from + step) % items.length; if (items[i]!.status === "PENDING") return i; }
  return from;
};

export function placeCurrent(walk: Walk, pin: Pin, level: number, parentName?: string): Walk {
  const item = walk.items[walk.current];
  if (!item) return walk;
  const placed: WalkItem = { text: item.text, status: "PLACED", pin, level, ...(parentName ? { parentName } : {}) };
  const next = replaceAt(walk, walk.current, placed);
  return { ...next, current: nextPending(next.items, walk.current) };
}

export function skipCurrent(walk: Walk): Walk {
  const item = walk.items[walk.current];
  if (!item) return walk;
  const next = replaceAt(walk, walk.current, { ...item, status: "SKIPPED" });
  return { ...next, current: nextPending(next.items, walk.current) };
}

export const goTo = (walk: Walk, index: number): Walk => (index >= 0 && index < walk.items.length ? { ...walk, current: index } : walk);
export const pendingCount = (walk: Walk): number => walk.items.filter((i) => i.status === "PENDING").length;
export const placedItems = (walk: Walk): WalkItem[] => walk.items.filter((i) => i.status === "PLACED");
export const isFinished = (walk: Walk): boolean => pendingCount(walk) === 0;

export function progressText(walk: Walk): string {
  const placed = placedItems(walk).length, skipped = walk.items.filter((i) => i.status === "SKIPPED").length;
  return `${placed} placed, ${skipped} skipped, ${pendingCount(walk)} to go.`;
}

const cell = (text: string): string => (/[",\n\r;\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The places sheet for what was placed, in the import's own columns. A text starting with = + - @ is defused so a spreadsheet never runs it. */
export function sheetFor(walk: Walk): string {
  const safe = (t: string): string => (/^[=+\-@]/.test(t) ? `'${t}` : t);
  const rows = placedItems(walk).map((i) => [cell(safe(i.text)), String(i.level), cell(i.parentName ? safe(i.parentName) : ""), String(i.pin!.latitude), String(i.pin!.longitude)].join(","));
  return ["Name,Level,Parent,Latitude,Longitude", ...rows].join("\n");
}
